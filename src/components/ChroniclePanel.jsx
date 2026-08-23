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
  onCompose,
  diceText,
  rollDisabled,
  npcs,
  onCreateNpc,
  onDeleteNpc,
  avatar,
  onAvatar,
  isOwn,
  backgroundUrl,
  onSetBackground,
  onClearBackground,
}) {
  const photos = Object.fromEntries(
    (members || []).map((m) => [m.player_id, m.photo || m.avatar]),
  )
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
        <GameLog entries={entries} onCopy={onCopy} photos={photos} />
      ) : null}
      {persist && tab === 'ficha' ? (
        <>
          {isDm ? (
            <div className="sheet-viewer">
              <div className="sheet-viewer-row">
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
              <div className="npc-bar">
                <span className="npc-label">NPCs</span>
                {npcs.map((npc) => (
                  <button
                    key={npc.player_id}
                    type="button"
                    className={sheetTarget === npc.player_id ? 'ghost is-on' : 'ghost'}
                    onClick={() => onSheetTarget(npc.player_id)}
                  >
                    {npc.name}
                  </button>
                ))}
                <button type="button" className="ghost" onClick={onCreateNpc} title="Crear ficha de NPC">+ NPC</button>
              </div>
              {sheetTarget?.startsWith('npc-') ? (
                <button type="button" className="ghost danger" onClick={() => onDeleteNpc(sheetTarget)}>Eliminar NPC</button>
              ) : null}
            </div>
          ) : null}
          <CharacterSheet
            sheet={sheet}
            readOnly={sheetReadOnly}
            status={sheetStatus}
            rollDisabled={rollDisabled}
            onChange={sheetReadOnly ? undefined : onSheetChange}
            onCompose={onCompose}
            diceText={diceText}
            avatar={avatar}
            onAvatar={onAvatar}
            isOwn={isOwn}
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
          backgroundUrl={backgroundUrl}
          onSetBackground={onSetBackground}
          onClearBackground={onClearBackground}
        />
      ) : null}
    </aside>
  )
}
