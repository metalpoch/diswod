import GameLog from './GameLog'
import MembersPanel from './MembersPanel'
import NotesPad from './NotesPad'
import Whiteboard from './Whiteboard'

export default function ChroniclePanel({
  tab,
  onTab,
  entries,
  onCopy,
  persist,
  playerId,
  mesa,
  members,
  me,
  isDm,
  onSetRole,
  onKick,
  onLeave,
  onCopyCode,
}) {
  return (
    <aside className="chronicle">
      <nav className="chronicle-tabs">
        <button type="button" className={tab === 'log' ? 'is-on' : ''} onClick={() => onTab('log')}>Gamelog</button>
        {persist ? (
          <>
            <button type="button" className={tab === 'notes' ? 'is-on' : ''} onClick={() => onTab('notes')}>Notas</button>
            <button type="button" className={tab === 'board' ? 'is-on' : ''} onClick={() => onTab('board')}>Pizarra</button>
            <button type="button" className={tab === 'mesa' ? 'is-on' : ''} onClick={() => onTab('mesa')}>Mesa</button>
          </>
        ) : null}
      </nav>
      {tab === 'log' || !persist ? (
        <GameLog entries={entries} onCopy={onCopy} />
      ) : null}
      {persist && tab === 'notes' ? <NotesPad mesaId={persist.mesaId} playerId={playerId} /> : null}
      {persist && tab === 'board' ? <Whiteboard mesaId={persist.mesaId} playerId={playerId} /> : null}
      {persist && tab === 'mesa' ? (
        <MembersPanel
          mesa={mesa}
          members={members}
          me={me}
          isDm={isDm}
          onCopy={onCopyCode}
          onSetRole={onSetRole}
          onKick={onKick}
          onLeave={onLeave}
        />
      ) : null}
    </aside>
  )
}
