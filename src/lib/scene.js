export const SCENE_CONDITION_KEYS = ['frenzy']

export const SCENE_CONTROL_AUTH_MESSAGE = 'Control de Escena requiere abrir la Activity dentro de Discord e iniciar sesión con la cuenta del Narrador. La web de prueba usa identidad local y no puede verificarla.'
export const SCENE_CONTROL_LOCAL_MESSAGE = 'Estás usando la web de prueba con identidad local. Abre la Activity dentro de Discord e inicia sesión con la cuenta verificada del Narrador para usar Control de Escena.'
export const SCENE_CONTROL_PARTICIPANT_MESSAGE = 'La selección de participante no es una autenticación OAuth. Vuelve a autenticarte y usa la Activity autenticada dentro de Discord con la cuenta del Narrador.'
export const SCENE_CONTROL_TOKEN_MESSAGE = 'No hay un token de Discord disponible o la sesión expiró. Vuelve a abrir la Activity dentro de Discord y reautentícate con la cuenta del Narrador.'
export const SCENE_CONTROL_DISCORD_AUTH_MESSAGE = 'La autenticación de Discord no es válida o expiró. Vuelve a abrir la Activity dentro de Discord y reautentícate con la cuenta del Narrador.'
export const SCENE_CONTROL_DM_MESSAGE = 'Tu cuenta está autenticada, pero esta mesa no reconoce tu vínculo/rol de Narrador. Si el ID local es legacy, entra con invitación y reclama/vincula el miembro Narrador con esta cuenta.'
export const SCENE_CONTROL_RETRY_MESSAGE = 'No se pudo guardar Escena por un error de conexión, función o persistencia. Comprueba la conexión y que estén aplicadas las migraciones de Escena; vuelve a intentarlo.'
export const SCENE_CONTROL_REJECTED_MESSAGE = 'El servicio de Escena rechazó el cambio. Comprueba los datos y permisos de la mesa.'

export function sceneControlAccessMessage({ identitySource, embedded, token }) {
  if (identitySource === 'local') return SCENE_CONTROL_LOCAL_MESSAGE
  if (identitySource === 'participant') return SCENE_CONTROL_PARTICIPANT_MESSAGE
  if (identitySource === 'discord-auth' && !String(token || '').trim()) return SCENE_CONTROL_TOKEN_MESSAGE
  if (identitySource === 'discord-auth' && embedded) return ''
  return SCENE_CONTROL_AUTH_MESSAGE
}

export function sceneControlErrorDetails({ identitySource, embedded, token, errorCode, status, networkError = false }) {
  const accessMessage = sceneControlAccessMessage({ identitySource, embedded, token })
  if (accessMessage) return { message: accessMessage, retryable: false }
  if (errorCode === 'discord_auth_required' || errorCode === 'discord_verification_failed') {
    return { message: SCENE_CONTROL_DISCORD_AUTH_MESSAGE, retryable: false }
  }
  if (errorCode === 'dm_required') return { message: SCENE_CONTROL_DM_MESSAGE, retryable: false }

  const transientCode = [
    'service_unavailable',
    'function_unavailable',
    'function_timeout',
    'edge_function_unavailable',
    'edge_function_timeout',
    'scene_service_unavailable',
    'backend_failure',
    'database_error',
    'database_failure',
    'database_unavailable',
    'database_timeout',
    'persistence_error',
    'persistence_unavailable',
    'network_error',
    'timeout',
  ].includes(errorCode)
  const retryable = networkError || Number(status) >= 500 || Number(status) === 429 || transientCode
  return {
    message: retryable ? SCENE_CONTROL_RETRY_MESSAGE : SCENE_CONTROL_REJECTED_MESSAGE,
    retryable,
  }
}

export function canAutoplayMusic({ persisted, ready, mode }) {
  return (!persisted || ready) && mode !== 'off'
}

export function sameSceneContext(left, right) {
  return Boolean(left && right
    && left.mesaId === right.mesaId
    && left.identityId === right.identityId
    && left.token === right.token
    && left.identitySource === right.identitySource
    && left.embedded === right.embedded
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
