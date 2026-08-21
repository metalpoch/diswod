import { useMemo, useState } from 'react'
import DicePanel from './components/DicePanel'
import GameLog from './components/GameLog'
import Help from './components/Help'
import NameGate from './components/NameGate'
import PlayerList from './components/PlayerList'
import { useActivity } from './hooks/useActivity'
import { useGameLog } from './hooks/useGameLog'
import { executeParsed, formatResultLine } from './lib/dice'

export default function App() {
  const activity = useActivity()
  const log = useGameLog(activity.roomId, activity.identity)
  const [toast, setToast] = useState('')
  const [showPlayers, setShowPlayers] = useState(false)

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
    await new Promise((resolve) => window.setTimeout(resolve, 380))
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
          <button type="button" className="ghost players-toggle" onClick={() => setShowPlayers((v) => !v)}>
            Jugadores
          </button>
        </div>
      </header>

      <main className={showPlayers ? 'show-players' : ''}>
        <GameLog entries={log.entries} onCopy={() => flash('Historial copiado')} />
        <PlayerList
          players={activity.mergePlayers(log.remotes)}
          identity={activity.identity}
          peers={log.peers}
        />
      </main>

      <DicePanel onRoll={onRoll} lastCommands={lastCommands} />
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
