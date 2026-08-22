export const MAX_PLAYERS = 4

export function makeInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const buf = new Uint8Array(6)
  crypto.getRandomValues(buf)
  return Array.from(buf, (n) => alphabet[n % alphabet.length]).join('')
}

export function normalizeInvite(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}

export function isSeatedRole(role) {
  return role === 'dm' || role === 'player'
}

export function seatedCount(members) {
  return (members || []).filter((m) => isSeatedRole(m.role)).length
}

export function canPromote(members) {
  return seatedCount(members) < MAX_PLAYERS
}

export function mapMember(row) {
  if (!row) return null
  return {
    player_id: row.player_id,
    id: row.player_id,
    player_name: row.player_name,
    name: row.player_name,
    avatar: row.avatar || null,
    role: row.role,
    muted: Boolean(row.muted),
    joined_at: row.joined_at,
  }
}
