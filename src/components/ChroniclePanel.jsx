import CharacterSheet from './CharacterSheet'
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
  onSetMuted,
  onKick,
  onLeave,
  onCopyCode,
  sheet,
  sheetStatus,
  sheetReadOnly,
  sheetTarget,
  onSheetTarget,
  onSheetChange,
  onSheetRoll,
  rollDisabled,
}) {
  return (
    <aside className="chronicle">
      <nav className="chronicle-tabs">
        <button type="button" className={tab === 'log' ? 'is-on' : ''} onClick={() => onTab('log')}>Gamelog</button>
        {persist ? (
          <>
            <button type="button" className={tab === 'ficha' ? 'is-on' : ''} onClick={() => onTab('ficha')}>Ficha</button>
            <button type="button" className={tab === 'notes' ? 'is-on' : ''} onClick={() => onTab('notes')}>Notas</button>
            <button type="button" className={tab === 'board' ? 'is-on' : ''} onClick={() => onTab('board')}>Pizarra</button>
            <button type="button" className={tab === 'mesa' ? 'is-on' : ''} onClick={() => onTab('mesa')}>Mesa</button>
          </>
        ) : null}
      </nav>
      {tab === 'log' || !persist ? (
        <GameLog entries={entries} onCopy={onCopy} />
      ) : null}
      {persist && tab === 'ficha' ? (
        <>
          {isDm ? (
            <div className="sheet-viewer">
              <label htmlFor="sheet-target">Ficha de</label>
              <select
                id="sheet-target"
                value={sheetTarget || ''}
                onChange={(e) => onSheetTarget(e.target.value || null)}
              >
                <option value="">Yo ({me?.name || 'Narrador'})</option>
                {members
                  .filter((m) => m.player_id !== me?.player_id)
                  .map((m) => (
                    <option key={m.player_id} value={m.player_id}>{m.name}</option>
                  ))}
              </select>
            </div>
          ) : null}
          <CharacterSheet
            sheet={sheet}
            readOnly={sheetReadOnly}
            status={sheetStatus}
            rollDisabled={rollDisabled}
            onChange={sheetReadOnly ? undefined : onSheetChange}
            onRoll={onSheetRoll}
          />
        </>
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
          onSetMuted={onSetMuted}
          onKick={onKick}
          onLeave={onLeave}
        />
      ) : null}
    </aside>
  )
}
