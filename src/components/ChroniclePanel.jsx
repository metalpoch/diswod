import CharacterSheet from './CharacterSheet'
import GameLog from './GameLog'
import MembersPanel from './MembersPanel'
import NotesPad from './NotesPad'
import ScenePanel from './ScenePanel'
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
  sheetReady,
  sheetError,
  onRetrySheet,
  onRetrySheetSave,
  sheetReadOnly,
  sheetTarget,
  onSheetTarget,
  sheetTargetReady,
  npcTargetReady,
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
  scene,
  musicPlayback,
  onSceneMusic,
  onSceneFrenzy,
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
            <button type="button" className={tab === 'scene' ? 'is-on' : ''} onClick={() => onTab('scene')}>Escena</button>
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
                  disabled={!sheetTargetReady}
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
                    disabled={!sheetTargetReady || !npcTargetReady}
                  >
                    {npc.name}
                  </button>
                ))}
                <button type="button" className="ghost" onClick={onCreateNpc} title="Crear ficha de NPC" disabled={!sheetTargetReady || !npcTargetReady}>+ NPC</button>
              </div>
              {sheetTarget?.startsWith('npc-') ? (
                <button type="button" className="ghost danger" onClick={() => onDeleteNpc(sheetTarget)} disabled={!sheetTargetReady || !npcTargetReady}>Eliminar NPC</button>
              ) : null}
            </div>
          ) : null}
          <div className="sheet-frame" aria-busy={!sheetReady}>
            {!sheetReady ? (
              <div className="sheet-load-state" role="status" aria-live="polite">
                <span className="sheet-state-mark" aria-hidden="true">◌</span>
                <div><strong>Cargando ficha</strong><p>Esperando los datos guardados de este personaje.</p></div>
              </div>
            ) : sheetError ? (
              <div className="sheet-load-state is-error" role="alert">
                <span className="sheet-state-mark" aria-hidden="true">!</span>
                <div><strong>No se pudo abrir la ficha</strong><p>{sheetError}</p>
                  <button type="button" className="ghost" onClick={onRetrySheet}>Volver a intentar</button>
                </div>
              </div>
            ) : (
              <CharacterSheet
                key={playerId}
                sheet={sheet}
                readOnly={sheetReadOnly}
                status={sheetStatus}
                onRetrySave={onRetrySheetSave}
                rollDisabled={rollDisabled}
                onChange={sheetReadOnly ? undefined : onSheetChange}
                onCompose={onCompose}
                diceText={diceText}
                avatar={avatar}
                onAvatar={onAvatar}
                isOwn={isOwn}
              />
            )}
          </div>
        </>
      ) : null}
      {persist && tab === 'notes' ? <NotesPad mesaId={persist.mesaId} playerId={playerId} /> : null}
      {persist && tab === 'board' ? <Whiteboard mesaId={persist.mesaId} playerId={playerId} /> : null}
      {persist && tab === 'scene' ? (
        <ScenePanel
          members={members}
          tracks={scene?.tracks || []}
          music={scene?.music || { mode: 'auto', trackId: null, stale: false }}
          conditions={scene?.conditions || []}
          ready={scene?.ready}
          error={scene?.error}
          onRetry={scene?.retry}
          controlError={scene?.controlError}
          controlRetryable={scene?.controlRetryable}
          onRetryControl={scene?.retryControl}
          controlAccessMessage={scene?.controlAccessMessage}
          canControl={scene?.canControl}
          playbackError={musicPlayback?.playbackError}
          localFallback={musicPlayback?.localFallback}
          onRetryMusic={musicPlayback?.retryMusic}
          onUseAutomatic={musicPlayback?.useAutomatic}
          isDm={isDm}
          onMusic={onSceneMusic}
          onFrenzy={onSceneFrenzy}
          backgroundUrl={backgroundUrl}
          onSetBackground={onSetBackground}
          onClearBackground={onClearBackground}
        />
      ) : null}
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
