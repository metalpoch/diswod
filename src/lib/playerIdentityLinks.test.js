import { beforeEach, describe, expect, it, vi } from 'vitest'
const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { functions: { invoke: mockInvoke } } }))

import {
  availableLegacyCandidates,
  canUsePersistentIdentity,
  claimLegacyPlayer,
  effectivePlayerId,
  getLegacyClaimCandidates,
  identityClaimContextMatches,
  identityMembershipPairs,
  identityMesaPairs,
  identityWithMesaClaim,
  isVerifiedClaimIdentity,
  normalizeIdentityLinks,
  resolvePlayerIdentityLinks,
} from './playerIdentityLinks'

describe('player identity links', () => {
  beforeEach(() => mockInvoke.mockReset())

  it('resolves only verified account links and includes direct future IDs in mesa lookups', () => {
    const identity = {
      id: 'discord-42',
      discordId: 'discord-42',
      links: normalizeIdentityLinks([
        { mesa_id: 'old-mesa', player_id: 'local-percival' },
        { mesa_id: 'second-mesa', player_id: 'local-percival' },
        { mesa_id: null, player_id: 'ignored' },
      ]),
    }

    expect(effectivePlayerId(identity, 'old-mesa')).toBe('local-percival')
    expect(effectivePlayerId(identity, 'new-mesa')).toBe('discord-42')
    expect(identityMesaPairs(identity)).toEqual([
      { mesaId: 'old-mesa', playerId: 'local-percival' },
      { mesaId: 'second-mesa', playerId: 'local-percival' },
    ])
  })

  it('only offers eligible local DM/player rows that have no existing account link', () => {
    const roster = [
      { player_id: 'local-a', role: 'dm' },
      { player_id: 'local-b', role: 'player' },
      { player_id: 'local-visitor', role: 'visitor' },
      { player_id: 'discord-future', role: 'player' },
    ]

    expect(availableLegacyCandidates(roster, ['local-a']).map((row) => row.player_id)).toEqual(['local-b'])
  })

  it('replaces a mesa-specific claim while preserving other mesa links', () => {
    const original = {
      id: 'discord-42',
      links: [
        { mesaId: 'old-mesa', playerId: 'local-old' },
        { mesaId: 'another-mesa', playerId: 'local-another' },
      ],
    }

    expect(identityWithMesaClaim(original, 'old-mesa', 'local-new').links).toEqual([
      { mesaId: 'another-mesa', playerId: 'local-another' },
      { mesaId: 'old-mesa', playerId: 'local-new' },
    ])
  })

  it('keeps data operations scoped to the mesa/player pair instead of expanding a legacy ID globally', () => {
    const targets = identityMembershipPairs({
      id: 'discord-42',
      links: [{ mesaId: 'mesa-one', playerId: 'local-shared' }],
    }, [{ mesa_id: 'mesa-two', player_id: 'discord-42' }])

    expect(targets).toEqual([
      { mesa_id: 'mesa-two', player_id: 'discord-42' },
      { mesa_id: 'mesa-one', player_id: 'local-shared' },
    ])
    expect(targets).not.toContainEqual({ mesa_id: 'mesa-two', player_id: 'local-shared' })
  })

  it('never starts a claim with local/participant identity or without the in-memory OAuth token', async () => {
    expect(isVerifiedClaimIdentity({ id: 'local-device', source: 'local' }, 'fake-token')).toBe(false)
    expect(isVerifiedClaimIdentity({ id: 'participant', source: 'participant' }, 'fake-token')).toBe(false)
    expect(isVerifiedClaimIdentity({ id: 'discord-42', discordId: 'discord-42', source: 'discord-auth' }, '')).toBe(false)
    await expect(resolvePlayerIdentityLinks('')).rejects.toThrow(/sesión autenticada de Discord/)
    expect(canUsePersistentIdentity({ id: 'local-dev', source: 'local' }, false)).toBe(true)
    expect(canUsePersistentIdentity({ id: 'local-dev', source: 'local' }, true)).toBe(false)
    expect(canUsePersistentIdentity({ id: 'participant', source: 'participant' }, true)).toBe(false)
  })

  it('rejects claim responses after the account, mesa, or request generation changed', () => {
    const context = { mesaId: 'mesa-a', discordUserId: 'discord-a', generation: 4, contextGeneration: 2 }
    expect(identityClaimContextMatches(context, context)).toBe(true)
    expect(identityClaimContextMatches(context, { ...context, mesaId: 'mesa-b' })).toBe(false)
    expect(identityClaimContextMatches(context, { ...context, discordUserId: 'discord-b' })).toBe(false)
    expect(identityClaimContextMatches(context, { ...context, generation: 5 })).toBe(false)
    expect(identityClaimContextMatches(context, { ...context, contextGeneration: 3 })).toBe(false)
  })

  it('returns direct membership and legacy candidates together instead of silently preferring direct', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        direct_member: { player_id: 'discord-42', player_name: 'Jugador actual' },
        candidates: [{ player_id: 'local-old', player_name: 'Personaje anterior', role: 'player' }],
      },
      error: null,
    })
    await expect(getLegacyClaimCandidates('oauth-memory-token', 'mesa-a', 'INVITE'))
      .resolves.toEqual({
        linkedPlayerId: '',
        directMember: { playerId: 'discord-42', playerName: 'Jugador actual' },
        candidates: [{ playerId: 'local-old', playerName: 'Personaje anterior', role: 'player' }],
      })
  })

  it('sends only mesa/member selectors to the Edge Function and surfaces concurrent-claim conflicts', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { context: { status: 409 } } })
    await expect(claimLegacyPlayer('memory-only-oauth-token', 'mesa-uuid', 'local-percival', 'INVITE'))
      .rejects.toMatchObject({ code: 'CLAIM_CONFLICT' })

    expect(mockInvoke).toHaveBeenCalledWith('mesa-player-identity', {
      body: {
        action: 'claim',
        mesa_id: 'mesa-uuid',
        player_id: 'local-percival',
        invite_code: 'INVITE',
        confirmed_dm: false,
      },
      headers: { Authorization: 'Bearer memory-only-oauth-token' },
    })
    expect(JSON.stringify(mockInvoke.mock.calls)).not.toContain('discord_user_id')
  })
})
