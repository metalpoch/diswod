export const SCENE_TRACK_IDS = [
  'alex-morgan-ambient-horror-creepy-atmosphere-dark-587402.mp3',
  'atlasaudio-sting-578929.mp3',
  'ribhavagrawal-ghostly-groove-dark-ambience-230665.mp3',
  'ribhavagrawal-terror-heights-dark-ambience-230667.mp3',
  'suno-Bleak Ritual v2.mp3',
  'suno-Bleak Ritual.mp3',
  'suno-Masquerade Rust V2.mp3',
  'suno-Masquerade Rust.mp3',
  'suno-Pasillo Hundido.mp3',
  'welbornworks-thevoid-326712.mp3',
  'willianbalfe-game-menu-music-box-horro-soundtrack-248291.mp3',
]

export function resolveDmActor({ discordUserId, mesaId, directMember, legacyLink, linkedMember }) {
  if (directMember?.player_id === discordUserId && directMember.role === 'dm') {
    return { authorized: true, playerId: directMember.player_id, via: 'direct' }
  }
  if (legacyLink?.mesa_id === mesaId
      && legacyLink.player_id
      && linkedMember?.player_id === legacyLink.player_id
      && linkedMember.role === 'dm') {
    return { authorized: true, playerId: linkedMember.player_id, via: 'legacy' }
  }
  return { authorized: false, playerId: '', via: '' }
}

export function canControlScene({ mesaId, requestedMesaId, actorRole, targetMesaId, targetRole, conditionKey }) {
  if (!mesaId || requestedMesaId !== mesaId || actorRole !== 'dm') return false
  if (targetMesaId !== mesaId || targetRole === 'visitor') return false
  if (conditionKey !== undefined && conditionKey !== 'frenzy') return false
  return true
}

export function validServerMusicSelection(mode, trackId) {
  if (mode === 'auto' || mode === 'off') return trackId == null || trackId === ''
  return mode === 'track' && typeof trackId === 'string' && SCENE_TRACK_IDS.includes(trackId)
}
