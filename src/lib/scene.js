export const SCENE_CONDITION_KEYS = ['frenzy']

export function canAutoplayMusic({ persisted, ready, mode }) {
  return (!persisted || ready) && mode !== 'off'
}

export function sameSceneContext(left, right) {
  return Boolean(left && right
    && left.mesaId === right.mesaId
    && left.identityId === right.identityId
    && left.token === right.token
    && left.isDm === right.isDm
    && left.generation === right.generation)
}

export function musicErrorTransition({ mode, fallbackUsed }) {
  if (mode === 'track' && !fallbackUsed) return { fallbackUsed: true, stopped: false }
  return { fallbackUsed, stopped: true }
}

export function clearMusicTimer(timerRef, clearTimer = globalThis.clearTimeout) {
  if (timerRef.current != null) clearTimer(timerRef.current)
  timerRef.current = null
}

export function trackId(track) {
  return typeof track === 'string' ? track : String(track?.id || '')
}

export function normalizeTrackList(rawTracks) {
  if (!Array.isArray(rawTracks)) return []
  return rawTracks
    .map((track) => {
      const id = trackId(track)
      if (!id || id.includes('/') || id.includes('\\')) return null
      const title = typeof track === 'object' && track
        ? String(track.title || id.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
        : id.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
      return { id, title }
    })
    .filter(Boolean)
}

export function normalizeMusicSetting(row, tracks) {
  const mode = row?.music_mode || 'auto'
  const track = tracks.find((item) => item.id === row?.track_id)
  if (mode === 'auto' || mode === 'off') {
    return { mode, trackId: null, stale: false, updatedBy: row?.updated_by || '', updatedAt: row?.updated_at || '' }
  }
  if (mode === 'track' && track) {
    return { mode, trackId: track.id, stale: false, updatedBy: row?.updated_by || '', updatedAt: row?.updated_at || '' }
  }
  return { mode: 'auto', trackId: null, stale: Boolean(row), updatedBy: row?.updated_by || '', updatedAt: row?.updated_at || '' }
}

export function validMusicSelection(selection, allowedTrackIds) {
  if (!selection || !['auto', 'off', 'track'].includes(selection.mode)) return false
  if (selection.mode !== 'track') return selection.trackId == null || selection.trackId === ''
  return typeof selection.trackId === 'string' && allowedTrackIds.includes(selection.trackId)
}

export function frenzyForPlayer(conditions, playerId) {
  return Boolean((conditions || []).find((condition) => (
    condition.key === 'frenzy'
    && condition.player_id === playerId
    && condition.active === true
  )))
}

export function buildFrenzyUpdate(mesaId, playerId, active) {
  return { mesa_id: mesaId, player_id: playerId, key: 'frenzy', active: active === true }
}
