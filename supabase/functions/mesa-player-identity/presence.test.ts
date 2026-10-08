import { describe, expect, it, vi } from 'vitest'
import { resolveDmPresence, validPresenceRequest } from './presence.ts'

const mesaId = '11111111-1111-4111-8111-111111111111'
const requester = '100000000000000001'
const dmDiscordId = '100000000000000002'
const localDmId = 'local-narrador'

function makeQuery({ mesa = { id: mesaId, dm_id: localDmId }, members = [], links = [] } = {}) {
  const paths: string[] = []
  const query = vi.fn(async (path: string) => {
    paths.push(path)
    if (path.startsWith('mesas?')) return mesa ? [mesa] : []
    if (path.includes(`player_id=eq.${requester}`) && path.startsWith('mesa_members?')) return members.filter((row) => row.player_id === requester)
    if (path.includes(`discord_user_id=eq.${requester}`)) return links.filter((row) => row.discord_user_id === requester)
    if (path.startsWith('mesa_members?') && path.includes(`player_id=eq.${localDmId}`) && path.includes('role=eq.dm')) return members.filter((row) => row.player_id === localDmId && row.role === 'dm')
    if (path.startsWith('mesa_members?') && path.includes('player_id=eq.local-requester')) return members.filter((row) => row.player_id === 'local-requester')
    if (path.startsWith('mesa_members?') && path.includes('role=eq.dm')) return members.filter((row) => row.role === 'dm')
    if (path.startsWith('mesa_player_identity_links?') && path.includes(`player_id=eq.${localDmId}`)) return links.filter((row) => row.player_id === localDmId)
    return []
  })
  return { query, paths }
}

const requesterRows = { members: [{ player_id: requester, role: 'player' }] }

describe('dm presence resolution', () => {
  it('resolves direct Narrador online and offline from exact participant IDs', async () => {
    const { query } = makeQuery({
      mesa: { id: mesaId, dm_id: dmDiscordId },
      members: [...requesterRows.members, { player_id: dmDiscordId, role: 'dm' }],
    })
    await expect(resolveDmPresence({ mesaId, requesterDiscordId: requester, participantIds: [dmDiscordId], query }))
      .resolves.toEqual({ status: 'online' })
    await expect(resolveDmPresence({ mesaId, requesterDiscordId: requester, participantIds: ['100000000000000020'], query }))
      .resolves.toEqual({ status: 'offline' })
  })

  it('resolves legacy linked Narrador online/offline and reports unlinked legacy Narrador', async () => {
    const linked = makeQuery({
      members: [...requesterRows.members, { player_id: localDmId, role: 'dm' }],
      links: [{ player_id: localDmId, discord_user_id: dmDiscordId }],
    })
    await expect(resolveDmPresence({ mesaId, requesterDiscordId: requester, participantIds: [dmDiscordId], query: linked.query }))
      .resolves.toEqual({ status: 'online' })
    await expect(resolveDmPresence({ mesaId, requesterDiscordId: requester, participantIds: [], query: linked.query }))
      .resolves.toEqual({ status: 'unknown' })

    const unlinked = makeQuery({ members: [...requesterRows.members, { player_id: localDmId, role: 'dm' }] })
    await expect(resolveDmPresence({ mesaId, requesterDiscordId: requester, participantIds: [dmDiscordId], query: unlinked.query }))
      .resolves.toEqual({ status: 'unlinked' })
  })

  it('denies a requester who is neither a direct member nor mapped in this mesa', async () => {
    const { query } = makeQuery({ members: [{ player_id: localDmId, role: 'dm' }] })
    await expect(resolveDmPresence({ mesaId, requesterDiscordId: requester, participantIds: [dmDiscordId], query }))
      .rejects.toThrow('presence_requester_denied')
  })

  it('accepts a requester authenticated through its mesa-scoped legacy mapping', async () => {
    const { query } = makeQuery({
      members: [{ player_id: localDmId, role: 'dm' }, { player_id: 'local-requester', role: 'player' }],
      links: [
        { player_id: 'local-requester', discord_user_id: requester },
        { player_id: localDmId, discord_user_id: dmDiscordId },
      ],
    })
    await expect(resolveDmPresence({ mesaId, requesterDiscordId: requester, participantIds: [dmDiscordId], query }))
      .resolves.toEqual({ status: 'online' })
  })

  it('rejects a requester whose mesa-scoped identity mapping is orphaned', async () => {
    const { query } = makeQuery({
      members: [{ player_id: localDmId, role: 'dm' }],
      links: [{ player_id: 'local-orphan', discord_user_id: requester }],
    })
    await expect(resolveDmPresence({ mesaId, requesterDiscordId: requester, participantIds: [dmDiscordId], query }))
      .rejects.toThrow('presence_requester_denied')
  })

  it('does not report presence when a linked Narrador no longer has the DM role', async () => {
    const paths: string[] = []
    const query = vi.fn(async (path: string) => {
      paths.push(path)
      if (path.startsWith('mesas?')) return [{ id: mesaId, dm_id: localDmId }]
      if (path.includes(`player_id=eq.${requester}`) && path.startsWith('mesa_members?')) return [{ player_id: requester }]
      if (path.includes(`discord_user_id=eq.${requester}`)) return []
      if (path.startsWith('mesa_members?') && path.includes(`player_id=eq.${localDmId}`) && path.includes('role=eq.dm')) return []
      if (path.startsWith('mesa_members?') && path.includes('role=eq.dm')) return [{ player_id: localDmId }]
      if (path.startsWith('mesa_player_identity_links?') && path.includes(`player_id=eq.${localDmId}`)) {
        return [{ discord_user_id: dmDiscordId }]
      }
      return []
    })
    await expect(resolveDmPresence({ mesaId, requesterDiscordId: requester, participantIds: [dmDiscordId], query }))
      .resolves.toEqual({ status: 'unknown' })
    expect(paths.some((path) => path.includes('player_id=eq.local-narrador') && path.includes('role=eq.dm'))).toBe(true)
  })

  it('returns unknown for a missing/mismatched mesa, multiple DMs, or dm_id conflict', async () => {
    const missing = makeQuery({ mesa: { id: '22222222-2222-4222-8222-222222222222', dm_id: localDmId } })
    await expect(resolveDmPresence({ mesaId, requesterDiscordId: requester, participantIds: [], query: missing.query }))
      .resolves.toEqual({ status: 'unknown' })

    const multiple = makeQuery({ members: [...requesterRows.members, { player_id: localDmId, role: 'dm' }, { player_id: 'local-other', role: 'dm' }] })
    await expect(resolveDmPresence({ mesaId, requesterDiscordId: requester, participantIds: [requester], query: multiple.query }))
      .resolves.toEqual({ status: 'unknown' })

    const conflict = makeQuery({ mesa: { id: mesaId, dm_id: 'local-other' }, members: [...requesterRows.members, { player_id: localDmId, role: 'dm' }] })
    await expect(resolveDmPresence({ mesaId, requesterDiscordId: requester, participantIds: [requester], query: conflict.query }))
      .resolves.toEqual({ status: 'unknown' })
  })

  it('compares only exact IDs, never queries persisted logs, and exposes no mapping IDs', async () => {
    const { query, paths } = makeQuery({
      members: [...requesterRows.members, { player_id: localDmId, role: 'dm' }],
      links: [{ player_id: localDmId, discord_user_id: dmDiscordId }],
    })
    const result = await resolveDmPresence({
      mesaId,
      requesterDiscordId: requester,
      participantIds: ['910000000000000002'],
      query,
    })
    expect(result).toEqual({ status: 'offline' })
    expect(paths.some((path) => path.includes('log_entries'))).toBe(false)
    expect(JSON.stringify(result)).not.toContain(dmDiscordId)
    expect(JSON.stringify(result)).not.toContain(localDmId)
  })

  it('accepts only the minimal action payload and a bounded list of Discord ID strings', () => {
    expect(validPresenceRequest({ action: 'dm_presence', mesa_id: mesaId, participant_ids: [requester] })).toBe(true)
    expect(validPresenceRequest({ action: 'dm_presence', mesa_id: mesaId, participant_ids: ['not-a-discord-id'] })).toBe(false)
    expect(validPresenceRequest({ action: 'dm_presence', mesa_id: mesaId, participant_ids: [], discord_user_id: requester })).toBe(false)
    expect(validPresenceRequest({ action: 'dm_presence', mesa_id: mesaId, participant_ids: [], dm_player_id: localDmId })).toBe(false)
    expect(validPresenceRequest({ action: 'dm_presence', mesa_id: mesaId, participant_ids: Array(65).fill(requester) })).toBe(false)
  })
})
