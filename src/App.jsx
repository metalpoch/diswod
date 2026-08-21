import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import ChroniclePanel from './components/ChroniclePanel'
import DicePanel from './components/DicePanel'
import Help from './components/Help'
import MesaLobby from './components/MesaLobby'
import NameGate from './components/NameGate'
import { useActivity } from './hooks/useActivity'
import { useGameLog } from './hooks/useGameLog'
import { useMembers } from './hooks/useMembers'
import { useMesas } from './hooks/useMesas'
import { executeParsed, formatResultLine } from './lib/dice'
import { hasSupabase } from './lib/supabase'
import { claimSeat, seatedFromMembers, seatedPlayers } from './lib/seats'

const Table3D = lazy(() => import('./components/Table3D'))

export default function App() {
  const activity = useActivity()
  const persistOn = hasSupabase()
  const archive = useMesas(persistOn, activity.identity)
  const [skipSave, setSkipSave] = useState(false)
  const [toast, setToast] = useState('')
  const [showLog, setShowLog] = useState(false)
  const [tab, setTab] = useState('log')

  const persist = persistOn && archive.current && !skipSave
    ? { enabled: true, mesaId: archive.current.id, sessionId: archive.current.currentSessionId }
    : { enabled: false }
  const roomId = persist.enabled ? `mesa-${persist.mesaId}` : activity.roomId
  const log = useGameLog(roomId, activity.identity, persist)
  const party = useMembers(persist.enabled ? persist.mesaId : '', activity.identity)

  const players = useMemo(
    () => activity.mergePlayers(log.remotes),
    [activity.participants, activity.identity, log.remotes],
  )
  const seats = useMemo(
    () => (persist.enabled
      ? seatedFromMembers(party.members.map((m) => ({
        ...m,
        self: m.player_id === activity.identity?.id,
      })))
      : seatedPlayers(players)),
    [persist.enabled, party.members, players, activity.identity],
  )
  const setIdentity = activity.setIdentity

  useEffect(() => {
    if (persist.enabled) return
    const me = activity.identity
    if (!me) return
    const next = claimSeat(me, log.remotes)
    if (next !== me.seat) setIdentity({ ...me, seat: next })
  }, [activity.identity, log.remotes, setIdentity, persist.enabled])

  useEffect(() => {
    if (!party.kicked) return
    archive.close()
    setTab('log')
    setToast('Te han expulsado de la mesa')
    window.setTimeout(() => setToast(''), 1800)
  }, [party.kicked])

  const lastCommands = useMemo(() => {
    const mine = log.entries
      .filter((e) => e.player?.id === activity.identity?.id)
      .map((e) => e.command)
    return [...new Set(mine.reverse())].slice(0, 20)
  }, [log.entries, activity.identity])

  const flash = (text) => {
    setToast(text)
    window.setTimeout(() => setToast(''), 1800)
  }

  const onRoll = async (parsed) => {
    const result = executeParsed(parsed)
    log.addEntry({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      player: activity.identity,
      command: parsed.command,
      result,
      line: formatResultLine(result),
    })
  }

  const leaveTable = async () => {
    await party.leave()
    archive.close()
    setTab('log')
    flash('Has salido de la mesa')
  }

  if (!activity.identity) {
    return (
      <NameGate
        participants={activity.participants}
        identity={activity.identity}
        embedded={activity.embedded}
        onSubmit={activity.setIdentity}
      />
    )
  }

  if (persistOn && !archive.current && !skipSave) {
    return (
      <MesaLobby
        identity={activity.identity}
        mesas={archive.mesas}
        loading={archive.loading}
        error={archive.error}
        onOpen={archive.open}
        onCreate={archive.create}
        onJoin={archive.join}
        onArchive={archive.archive}
        onReopen={archive.reopen}
        onSkip={() => setSkipSave(true)}
      />
    )
  }

  const taken = seats.filter(Boolean).length
  const localSeat = seats.findIndex((p) => p?.id === activity.identity.id)
  const mySeat = localSeat >= 0 ? localSeat : null

  return (
    <div className="app">
      <div className="veil" />
      <header className="topbar">
        <div className="brand">
          <span className="mark">✝</span>
          <div>
            <h1>Diswod</h1>
            <p>{archive.current ? archive.current.name : 'Vampiro: la Mascarada · V20'}</p>
          </div>
        </div>
        <div className="top-actions">
          <span className="occupancy">{taken}/4 en mesa</span>
          {persist.enabled && !party.isPlayer ? <span className="occupancy">Visitante</span> : null}
          {persistOn ? (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setSkipSave(false)
                archive.close()
                setTab('log')
              }}
            >
              Mesas
            </button>
          ) : null}
          {persist.enabled && party.isDm ? (
            <button
              type="button"
              className="ghost"
              onClick={async () => {
                const n = archive.sessions.length + 1
                await archive.newSession(`Sesión ${n}`)
                flash('Nueva sesión abierta')
              }}
            >
              Nueva sesión
            </button>
          ) : null}
          <button
            type="button"
            className="room"
            onClick={async () => {
              const text = persist.enabled && archive.current?.inviteCode
                ? archive.current.inviteCode
                : window.location.href
              await navigator.clipboard.writeText(text)
              flash(persist.enabled ? 'Código copiado' : 'Enlace copiado')
            }}
          >
            {persist.enabled && archive.current?.inviteCode
              ? archive.current.inviteCode
              : `Sala ${activity.roomId}`}
          </button>
          <Help />
          <button type="button" className="ghost players-toggle" onClick={() => setShowLog((v) => !v)}>
            Panel
          </button>
        </div>
      </header>

      <main className={showLog ? 'show-log' : ''}>
        <Suspense fallback={<div className="table-stage" />}>
          <Table3D
            seats={seats}
            entries={log.entries}
            localId={activity.identity.id}
            localSeat={mySeat}
          />
        </Suspense>
        <ChroniclePanel
          tab={tab}
          onTab={setTab}
          entries={log.entries}
          onCopy={() => flash('Historial copiado')}
          persist={persist.enabled ? persist : null}
          playerId={activity.identity.id}
          mesa={archive.current}
          members={party.members}
          me={party.me}
          isDm={party.isDm}
          onSetRole={async (id, role) => {
            try {
              await party.setRole(id, role)
            } catch (err) {
              flash(err.message || 'No se pudo cambiar el rol')
            }
          }}
          onKick={async (id) => {
            await party.kick(id)
            flash('Jugador expulsado')
          }}
          onLeave={leaveTable}
          onCopyCode={async (code) => {
            await navigator.clipboard.writeText(code)
            flash('Código copiado')
          }}
        />
      </main>

      <DicePanel onRoll={onRoll} lastCommands={lastCommands} />
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
