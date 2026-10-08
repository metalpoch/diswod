import { beforeEach, describe, expect, it, vi } from 'vitest'
const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { functions: { invoke: mockInvoke } } }))

import {
  availableLegacyCandidates,
  canUsePersistentIdentity,
  cancelIdentityClaimSelection,
  claimAndJoinLinkedIdentity,
  claimLegacyPlayer,
  confirmIdentityClaim,
  chooseIdentityClaimCandidate,
  createIdentityClaimContextGuard,
  effectivePlayerId,
  getLegacyClaimCandidates,
  getDmPresence,
  identityClaimContextMatches,
  identityClaimFailureMessage,
  identityClaimFailureState,
  identityClaimRequestMatches,
  identityClaimSelectionIsCurrent,
  identityMembershipPairs,
  identityMesaPairs,
  identityFunctionErrorCode,
  identityWithMesaClaim,
  isVerifiedClaimIdentity,
  normalizeIdentityLinks,
  resolvePlayerIdentityLinks,
} from './playerIdentityLinks'
import { claimRpcError } from '../../supabase/functions/mesa-player-identity/claimErrors.ts'

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

  it('keeps a claim guard bound to its captured mesa and identity as the current context changes', () => {
    const captured = { mesaId: 'mesa-a', discordUserId: 'discord-a', generation: 4, contextGeneration: 2 }
    let current = { ...captured }
    const isCurrent = createIdentityClaimContextGuard(captured, () => current)

    expect(isCurrent()).toBe(true)
    current = { ...captured, mesaId: 'mesa-b' }
    expect(isCurrent()).toBe(false)
    current = { ...captured, discordUserId: 'discord-b' }
    expect(isCurrent()).toBe(false)
  })

  it('passes the confirmed mesa-scoped legacy link into the post-claim join', async () => {
    const discordIdentity = {
      id: 'discord-42',
      discordId: 'discord-42',
      source: 'discord-auth',
      links: [{ mesaId: 'other-mesa', playerId: 'local-other' }],
    }
    let currentIdentity = discordIdentity
    const join = vi.fn(async (identity) => ({
      mesa: { id: 'mesa-a', myPlayerId: identity.links.find((link) => link.mesaId === 'mesa-a').playerId },
    }))
    const completion = await claimAndJoinLinkedIdentity({
      claim: async () => 'local-percival',
      isCurrent: () => true,
      storeLink: (claimedPlayerId) => {
        currentIdentity = identityWithMesaClaim(currentIdentity, 'mesa-a', claimedPlayerId)
        return currentIdentity
      },
      join,
    })

    expect(completion).toMatchObject({ cancelled: false, claimedPlayerId: 'local-percival' })
    expect(join).toHaveBeenCalledWith({
      ...discordIdentity,
      links: [
        { mesaId: 'other-mesa', playerId: 'local-other' },
        { mesaId: 'mesa-a', playerId: 'local-percival' },
      ],
    })
    expect(completion.identity.id).toBe('discord-42')
    expect(completion.joined.mesa.myPlayerId).toBe('local-percival')
  })

  it('does not link or join a stale claim response even though the claim RPC already succeeded', async () => {
    const claim = vi.fn().mockResolvedValue('local-percival')
    const storeLink = vi.fn()
    const join = vi.fn()

    const completion = await claimAndJoinLinkedIdentity({
      claim,
      isCurrent: () => false,
      storeLink,
      join,
    })

    expect(claim).toHaveBeenCalledOnce()
    expect(completion).toEqual({ cancelled: true, claimedPlayerId: 'local-percival' })
    expect(storeLink).not.toHaveBeenCalled()
    expect(join).not.toHaveBeenCalled()
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

  it('requests DM presence with only the mesa and bounded exact participant IDs', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { status: 'online' }, error: null })
    await expect(getDmPresence('oauth-token', 'mesa-uuid', [
      { id: '100000000000000001', username: 'private-name', avatar: 'private-avatar' },
      { id: '100000000000000001' },
    ])).resolves.toBe('online')

    expect(mockInvoke).toHaveBeenCalledWith('mesa-player-identity', {
      body: {
        action: 'dm_presence',
        mesa_id: 'mesa-uuid',
        participant_ids: ['100000000000000001'],
      },
      headers: { Authorization: 'Bearer oauth-token' },
    })
    expect(JSON.stringify(mockInvoke.mock.calls[0])).not.toContain('private-name')
    expect(JSON.stringify(mockInvoke.mock.calls[0])).not.toContain('discord_user_id')
  })

  it('treats errors and invalid responses as unknown without making empty-roster requests', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { status: 'someone' }, error: null })
    await expect(getDmPresence('oauth-token', 'mesa-uuid', [{ id: '100000000000000001' }])).resolves.toBe('unknown')
    await expect(getDmPresence('oauth-token', 'mesa-uuid', [])).resolves.toBe('unknown')
    expect(mockInvoke).toHaveBeenCalledOnce()
  })

  it('returns unknown instead of truncating oversized or malformed rosters', async () => {
    await expect(getDmPresence('oauth-token', 'mesa-uuid', Array(65).fill({ id: '100000000000000001' })))
      .resolves.toBe('unknown')
    await expect(getDmPresence('oauth-token', 'mesa-uuid', [{ id: 'invalid' }])).resolves.toBe('unknown')
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('opens DM confirmation without claiming and cancellation only closes that step', () => {
    const claim = vi.fn()
    const select = vi.fn()
    const cancel = vi.fn()
    const candidate = { playerId: 'local-dm', playerName: 'Cronista', role: 'dm' }
    const context = { mesaId: 'mesa-a', discordUserId: 'discord-a', generation: 4, contextGeneration: 2 }

    expect(chooseIdentityClaimCandidate(candidate, { context, onSelectDm: select, onClaim: claim })).toBe('confirmation')
    expect(select).toHaveBeenCalledWith({
      candidate: { playerId: 'local-dm', playerName: 'Cronista', role: 'dm' },
      context,
      requiresConfirmation: true,
    })
    expect(claim).not.toHaveBeenCalled()
    expect(cancelIdentityClaimSelection(cancel)).toBeNull()
    expect(cancel).toHaveBeenCalledWith(null)
    expect(claim).not.toHaveBeenCalled()
  })

  it('keeps normal player rows on the direct claim path', () => {
    const claim = vi.fn()
    const select = vi.fn()
    const candidate = { playerId: 'local-player', playerName: 'Jugador', role: 'player' }

    const context = { mesaId: 'mesa-a', discordUserId: 'discord-a', generation: 4, contextGeneration: 2 }
    expect(chooseIdentityClaimCandidate(candidate, { context, onSelectDm: select, onClaim: claim })).toBe('claimed')
    expect(claim).toHaveBeenCalledWith('local-player', false, context)
    expect(select).not.toHaveBeenCalled()
  })

  it('sends confirmed_dm only after explicit confirmation for the selected DM player', async () => {
    const claim = vi.fn().mockResolvedValue(undefined)
    const candidate = { playerId: 'local-dm', playerName: 'Cronista', role: 'dm' }
    const context = { mesaId: 'mesa-a', discordUserId: 'discord-a', generation: 4, contextGeneration: 2 }
    const selection = { candidate, context }
    const currentClaim = { context, candidates: [candidate] }

    await expect(confirmIdentityClaim({
      selection,
      currentClaim,
      isCurrent: () => true,
      claim,
    })).resolves.toBe(true)
    expect(claim).toHaveBeenCalledOnce()
    expect(claim).toHaveBeenCalledWith('local-dm', true, context, 'dm')
  })

  it('cancels a stale DM target without invoking the claim callback', async () => {
    const claim = vi.fn()
    const candidate = { playerId: 'local-dm', playerName: 'Cronista', role: 'dm' }
    const context = { mesaId: 'mesa-a', discordUserId: 'discord-a', generation: 4, contextGeneration: 2 }

    await expect(confirmIdentityClaim({
      selection: { candidate, context },
      currentClaim: { context, candidates: [candidate] },
      isCurrent: () => false,
      claim,
    })).resolves.toBe(false)
    expect(claim).not.toHaveBeenCalled()
  })

  it('does not dispatch a selected DM claim after mesa, generation, identity, or candidate role/id changes', async () => {
    const candidate = { playerId: 'local-dm-a', playerName: 'Cronista', role: 'dm' }
    const contextA = { mesaId: 'mesa-a', discordUserId: 'discord-a', generation: 4, contextGeneration: 2 }
    const select = vi.fn()
    chooseIdentityClaimCandidate(candidate, {
      context: contextA,
      onSelectDm: select,
      onClaim: vi.fn(),
    })
    const selection = select.mock.calls[0][0]

    const staleClaims = [
      { context: { ...contextA, mesaId: 'mesa-b' }, candidates: [candidate] },
      { context: { ...contextA, generation: 5 }, candidates: [candidate] },
      { context: { ...contextA, discordUserId: 'discord-b' }, candidates: [candidate] },
      { context: contextA, candidates: [{ ...candidate, role: 'player' }] },
      { context: contextA, candidates: [{ ...candidate, playerId: 'local-dm-b' }] },
    ]

    for (const currentClaim of staleClaims) {
      mockInvoke.mockReset()
      const currentCandidate = currentClaim.candidates[0]
      const dispatchClaim = (playerId, confirmedDm, expectedContext, role) => claimLegacyPlayer(
        'oauth-memory-token',
        expectedContext.mesaId,
        playerId,
        'INVITE',
        confirmedDm,
      )
      const confirmed = await confirmIdentityClaim({
        selection,
        currentClaim,
        isCurrent: (context, playerId, role) => identityClaimRequestMatches(
          context,
          { playerId, role },
          currentClaim.context,
          currentCandidate,
        ),
        claim: dispatchClaim,
      })

      expect(confirmed).toBe(false)
      expect(mockInvoke).not.toHaveBeenCalled()
    }
    expect(identityClaimSelectionIsCurrent(selection, staleClaims[0])).toBe(false)
  })

  it('shows only generic copy when join or refresh fails after a successful claim', async () => {
    const pending = { error: '', busy: true, mesa: { name: 'Crónica' } }
    const sensitiveFailure = new Error('provider failure: bearer SECRET user discord-private')

    let claimPersisted = false
    try {
      await claimAndJoinLinkedIdentity({
        claim: async () => {
          claimPersisted = true
          return 'local-dm'
        },
        isCurrent: () => true,
        storeLink: () => ({ id: 'discord-user' }),
        join: async () => { throw sensitiveFailure },
      })
    } catch (error) {
      const state = identityClaimFailureState(pending, error, claimPersisted)
      expect(state.error).toBe('No se pudo completar la vinculación. El vínculo puede haberse guardado; vuelve a entrar con el código o contacta Narrador.')
      expect(state.busy).toBe(false)
      expect(JSON.stringify(state)).not.toMatch(/provider|SECRET|discord-private|bearer/i)
    }

    claimPersisted = true
    const refreshState = identityClaimFailureState(pending, sensitiveFailure, claimPersisted)
    expect(refreshState.error).toBe('No se pudo completar la vinculación. El vínculo puede haberse guardado; vuelve a entrar con el código o contacta Narrador.')
    expect(JSON.stringify(refreshState)).not.toMatch(/provider|SECRET|discord-private|bearer/i)
  })

  it('keeps only allowlisted identity claim messages for known error codes', () => {
    expect(identityClaimFailureMessage({ code: 'CLAIM_DM_CONFIRMATION_REQUIRED' }))
      .toMatch(/confirma explícitamente/)
    expect(identityClaimFailureMessage({ code: 'CLAIM_INVALID_INVITE' }))
      .toMatch(/código de invitación/)
    expect(identityClaimFailureMessage({ code: 'CLAIM_CONFLICT' }))
      .toMatch(/Otro jugador ya vinculó/)
    expect(identityClaimFailureMessage({ code: 'CLAIM_DISCORD_AUTH_REQUIRED' }))
      .toMatch(/Discord debe verificar/)
    expect(identityClaimFailureMessage({ code: 'CLAIM_TRANSIENT' }))
      .toMatch(/Comprueba tu conexión/)
    expect(identityClaimFailureMessage({ code: 'CLAIM_PROVIDER_RAW', message: 'SECRET' }))
      .toBe('No se pudo completar la vinculación. El vínculo puede haberse guardado; vuelve a entrar con el código o contacta Narrador.')
    expect(identityClaimFailureMessage({ code: 'toString', message: 'SECRET' }))
      .toBe('No se pudo completar la vinculación. El vínculo puede haberse guardado; vuelve a entrar con el código o contacta Narrador.')
  })

  it('maps the RPC DM confirmation requirement to its own conflict response', () => {
    expect(claimRpcError('dm_confirmation_required')).toEqual({
      error: 'dm_confirmation_required',
      status: 409,
    })
    expect(claimRpcError('invalid_candidate')).toEqual({ error: 'invalid_candidate', status: 400 })
  })

  it('parses only allowlisted error codes and never exposes raw response details', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: {
        context: new Response(JSON.stringify({
          error: 'dm_confirmation_required',
          message: 'Bearer SECRET and player local-private',
        }), { status: 409 }),
      },
    })
    await expect(claimLegacyPlayer('oauth-memory-token', 'mesa-a', 'local-dm', 'INVITE'))
      .rejects.toMatchObject({ code: 'CLAIM_DM_CONFIRMATION_REQUIRED' })

    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: {
        context: new Response(JSON.stringify({ error: 'local-private', message: 'SECRET' }), { status: 400 }),
      },
    })
    await expect(claimLegacyPlayer('oauth-memory-token', 'mesa-a', 'local-dm', 'INVITE'))
      .rejects.toMatchObject({ code: 'CLAIM_TRANSIENT' })

    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { context: { status: 400 }, message: 'Bearer SECRET local-private' },
    })
    const failure = await claimLegacyPlayer('oauth-memory-token', 'mesa-a', 'local-dm', 'INVITE').catch((error) => error)
    expect(failure.message).toBe('No se pudo verificar la identidad de mesa. Comprueba tu conexión e inténtalo de nuevo.')
    expect(failure.message).not.toMatch(/SECRET|local-private|Bearer/)
    expect(identityFunctionErrorCode(401)).toBe('discord_auth_required')
    expect(identityFunctionErrorCode(403, 'invalid_invite')).toBe('invalid_invite')
  })
})
