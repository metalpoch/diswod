import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import CharacterGate from './components/CharacterGate'
import ChroniclePanel from './components/ChroniclePanel'
import DicePanel from './components/DicePanel'
import DiscordOnly from './components/DiscordOnly'
import Help from './components/Help'
import MesaLobby from './components/MesaLobby'
import NameEdit from './components/NameEdit'
import NameGate from './components/NameGate'
import { useActivity } from './hooks/useActivity'
import { useGameLog } from './hooks/useGameLog'
import { useMembers } from './hooks/useMembers'
import { useMesas } from './hooks/useMesas'
import { executeParsed, formatResultLine } from './lib/dice'
import { colorFromName, isLikelyEmbedded } from './lib/discord'
import { deleteMyData, renameMember } from './lib/mesasApi'
import { hasSupabase } from './lib/supabase'
import { claimSeat, seatedFromMembers, seatedPlayers } from './lib/seats'
import { copyText } from './lib/clipboard'

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

  const charName = persist.enabled ? party.me?.name || activity.identity?.name : activity.identity?.name

  const dmId = persist.enabled ? archive.current?.dmId : ''
  const dmOnline = !persist.enabled || !dmId
    || activity.identity?.id === dmId
    || log.remotes.some((r) => r.id === dmId)
    || activity.participants.some((p) => p.id === dmId)
  const muted = Boolean(persist.enabled && party.me?.muted)
  const rollBlocked = muted || !dmOnline

  const onRoll = async (parsed) => {
    const result = executeParsed(parsed)
    log.addEntry({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      player: charName ? { ...activity.identity, name: charName } : activity.identity,
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

  const renameSelf = async (name) => {
    if (persist.enabled) {
      try {
        await renameMember(persist.mesaId, activity.identity.id, name)
        log.renamePlayer(activity.identity.id, name)
        flash('Nombre actualizado')
      } catch (err) {
        flash(err.message || 'No se pudo actualizar el nombre en la mesa')
      }
      return
    }
    const next = { ...activity.identity, name, color: colorFromName(name) }
    activity.setIdentity(next)
    log.renamePlayer(next.id, name)
  }

  if (!isLikelyEmbedded() && !import.meta.env.DEV && import.meta.env.VITE_ALLOW_WEB !== '1') {
    return <DiscordOnly />
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
        onErase={async () => {
          if (!window.confirm('¿Borrar tus notas, pizarra y mesas? Las tiradas quedarán anónimas.')) return
          try {
            await deleteMyData(activity.identity.id)
            localStorage.removeItem('diswod.identity')
            flash('Datos borrados')
            window.setTimeout(() => window.location.reload(), 600)
          } catch (err) {
            flash(err.message || 'No se pudieron borrar los datos')
          }
        }}
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
          {!persist.enabled ? (
            <button
              type="button"
              className="room"
              onClick={async () => {
                const ok = await copyText(window.location.href)
                flash(ok ? 'Enlace copiado' : 'No se pudo copiar')
              }}
            >
              Sala {activity.roomId}
            </button>
          ) : null}
          <NameEdit name={charName} onRename={renameSelf} />
          <button type="button" className="ghost players-toggle" onClick={() => setShowLog((v) => !v)}>
            Panel
          </button>
          <Help />
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
          onCopy={(ok) => flash(ok ? 'Historial copiado' : 'No se pudo copiar')}
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
          onSetMuted={async (id, mutedFlag) => {
            try {
              await party.setMuted(id, mutedFlag)
              flash(mutedFlag ? 'Jugador silenciado' : 'Jugador activado')
            } catch (err) {
              flash(err.message || 'No se pudo silenciar al jugador')
            }
          }}
          onKick={async (id) => {
            await party.kick(id)
            flash('Jugador expulsado')
          }}
          onLeave={leaveTable}
          onCopyCode={async (code) => {
            const ok = await copyText(code)
            flash(ok ? 'Código copiado' : 'No se pudo copiar')
          }}
        />
      </main>

      <DicePanel
        onRoll={onRoll}
        disabled={rollBlocked}
        reason={muted
          ? 'El Narrador te ha silenciado.'
          : !dmOnline
            ? 'El Narrador no está en línea. Las tiradas están en pausa.'
            : ''}
        lastCommands={lastCommands}
      />
      {persist.enabled && archive.pendingCharName ? (
        <CharacterGate
          defaultName={activity.identity.name}
          onAccept={async (name) => {
            try {
              await renameMember(persist.mesaId, activity.identity.id, name)
              log.renamePlayer(activity.identity.id, name)
              archive.dismissCharName()
              flash(`Bienvenido, ${name}`)
            } catch (err) {
              flash(err.message || 'No se pudo guardar el nombre')
            }
          }}
          onDismiss={archive.dismissCharName}
        />
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
