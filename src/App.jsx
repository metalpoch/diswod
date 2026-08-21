import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import DicePanel from './components/DicePanel'
import GameLog from './components/GameLog'
import Help from './components/Help'
import NameGate from './components/NameGate'
import { useActivity } from './hooks/useActivity'
import { useGameLog } from './hooks/useGameLog'
import { executeParsed, formatResultLine } from './lib/dice'
import { claimSeat, seatedPlayers } from './lib/seats'

const Table3D = lazy(() => import('./components/Table3D'))

export default function App() {
  const activity = useActivity()
  const log = useGameLog(activity.roomId, activity.identity)
  const [toast, setToast] = useState('')
  const [showLog, setShowLog] = useState(false)

  const players = useMemo(
    () => activity.mergePlayers(log.remotes),
    [activity.participants, activity.identity, log.remotes],
  )
  const seats = useMemo(() => seatedPlayers(players), [players])
  const setIdentity = activity.setIdentity

  useEffect(() => {
    const me = activity.identity
    if (!me) return
    const next = claimSeat(me, log.remotes)
    if (next !== me.seat) setIdentity({ ...me, seat: next })
  }, [activity.identity, log.remotes, setIdentity])

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

  if (!activity.identity) {
    return (
      <NameGate
        participants={activity.participants}
        identity={activity.identity}
        onSubmit={activity.setIdentity}
      />
    )
  }

  const taken = seats.filter(Boolean).length
  const localSeat = seats.findIndex((p) => p?.id === activity.identity.id)
  const mySeat = localSeat >= 0 ? localSeat : activity.identity.seat

  return (
    <div className="app">
      <div className="veil" />
      <header className="topbar">
        <div className="brand">
          <span className="mark">✝</span>
          <div>
            <h1>Diswod</h1>
            <p>Vampiro: la Mascarada · V20</p>
          </div>
        </div>
        <div className="top-actions">
          <span className="occupancy">{taken}/4 en mesa</span>
          <button
            type="button"
            className="room"
            onClick={async () => {
              await navigator.clipboard.writeText(window.location.href)
              flash('Enlace de sala copiado')
            }}
          >
            Sala {activity.roomId}
          </button>
          <Help />
          <button type="button" className="ghost players-toggle" onClick={() => setShowLog((v) => !v)}>
            Gamelog
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
        <GameLog entries={log.entries} onCopy={() => flash('Historial copiado')} />
      </main>

      <DicePanel onRoll={onRoll} lastCommands={lastCommands} />
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
