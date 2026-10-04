export function sheetMatches(record, mesaId, playerId) {
  return Boolean(record)
    && record.mesaId === mesaId
    && record.playerId === playerId
}

export function isRosterReadyForMesa(roster, mesaId) {
  return Boolean(mesaId && roster?.ready && roster.rosterMesaId === mesaId)
}

export function canEditSheet(record, mesaId, playerId, authorized = true) {
  return sheetMatches(record, mesaId, playerId)
    && record.ready === true
    && !record.error
    && authorized
}

export function canViewSheetTarget({ mesaId, targetMesaId, isDm, memberIds = [], npcIds = [] }, playerId) {
  return Boolean(mesaId)
    && mesaId === targetMesaId
    && Boolean(isDm)
    && (memberIds.includes(playerId) || npcIds.includes(playerId))
}

export function canEditSheetTarget({
  mesaId,
  targetMesaId,
  identityId,
  isDm,
  memberIds = [],
  npcIds = [],
}, playerId) {
  if (!mesaId || mesaId !== targetMesaId || !playerId) return false
  if (playerId === identityId) return memberIds.includes(identityId)
  return Boolean(isDm) && npcIds.includes(playerId)
}
