const MESA_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DISCORD_ID_PATTERN = /^\d{17,20}$/

export type DmPresence = 'online' | 'offline' | 'unlinked' | 'unknown'
type Query = (path: string) => Promise<any[] | null>

export function validPresenceRequest(body: Record<string, unknown>) {
  const allowedKeys = new Set(['action', 'mesa_id', 'participant_ids'])
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) return false
  if (body.action !== 'dm_presence' || typeof body.mesa_id !== 'string' || !MESA_ID_PATTERN.test(body.mesa_id)) return false
  if (!Array.isArray(body.participant_ids) || body.participant_ids.length > 64) return false
  return body.participant_ids.every((id) => typeof id === 'string' && DISCORD_ID_PATTERN.test(id))
}

const queryValue = (value: string) => encodeURIComponent(value)

/** Resolves presence using only mesa-scoped membership and identity-link rows. */
export async function resolveDmPresence({
  mesaId,
  requesterDiscordId,
  participantIds,
  query,
}: {
  mesaId: string
  requesterDiscordId: string
  participantIds: string[]
  query: Query
}): Promise<{ status: DmPresence }> {
  const mesas = await query(`mesas?id=eq.${queryValue(mesaId)}&select=id,dm_id&limit=2`)
  if (mesas?.length !== 1 || mesas[0]?.id !== mesaId) return { status: 'unknown' }

  const [requesterMembers, requesterLinks] = await Promise.all([
    query(`mesa_members?mesa_id=eq.${queryValue(mesaId)}&player_id=eq.${queryValue(requesterDiscordId)}&select=player_id&limit=2`),
    query(`mesa_player_identity_links?mesa_id=eq.${queryValue(mesaId)}&discord_user_id=eq.${queryValue(requesterDiscordId)}&select=player_id&limit=2`),
  ])
  if ((requesterMembers?.length || 0) > 1) return { status: 'unknown' }
  if (!requesterMembers?.length) {
    if (!requesterLinks?.length) throw new PresenceRequesterDenied()
    if (requesterLinks.length !== 1 || typeof requesterLinks[0]?.player_id !== 'string') return { status: 'unknown' }
    const mappedRequesterMembers = await query(
      `mesa_members?mesa_id=eq.${queryValue(mesaId)}&player_id=eq.${queryValue(requesterLinks[0].player_id)}&select=player_id&limit=2`,
    )
    if (!mappedRequesterMembers?.length) throw new PresenceRequesterDenied()
    if (mappedRequesterMembers.length !== 1) return { status: 'unknown' }
  }
  if (participantIds.length === 0) return { status: 'unknown' }

  const dmMembers = await query(`mesa_members?mesa_id=eq.${queryValue(mesaId)}&role=eq.dm&select=player_id&limit=2`)
  if (dmMembers?.length !== 1 || !dmMembers[0]?.player_id) return { status: 'unknown' }
  const dmPlayerId = dmMembers[0].player_id
  if (mesas[0].dm_id && mesas[0].dm_id !== dmPlayerId) return { status: 'unknown' }

  let dmDiscordId: string
  if (String(dmPlayerId).startsWith('local-')) {
    const links = await query(
      `mesa_player_identity_links?mesa_id=eq.${queryValue(mesaId)}&player_id=eq.${queryValue(dmPlayerId)}&select=discord_user_id&limit=2`,
    )
    if (!links?.length) return { status: 'unlinked' }
    if (links.length !== 1 || !DISCORD_ID_PATTERN.test(links[0]?.discord_user_id || '')) return { status: 'unknown' }
    const currentDmMembers = await query(
      `mesa_members?mesa_id=eq.${queryValue(mesaId)}&player_id=eq.${queryValue(dmPlayerId)}&role=eq.dm&select=player_id&limit=2`,
    )
    if (currentDmMembers?.length !== 1 || currentDmMembers[0]?.player_id !== dmPlayerId) return { status: 'unknown' }
    dmDiscordId = links[0].discord_user_id
  } else {
    if (!DISCORD_ID_PATTERN.test(String(dmPlayerId))) return { status: 'unknown' }
    dmDiscordId = dmPlayerId
  }

  return { status: participantIds.includes(dmDiscordId) ? 'online' : 'offline' }
}

export class PresenceRequesterDenied extends Error {
  constructor() {
    super('presence_requester_denied')
  }
}
