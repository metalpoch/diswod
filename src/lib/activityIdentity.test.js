import { describe, expect, it, vi } from 'vitest'
import {
  establishAuthenticatedIdentity,
  authenticatedIdentity,
  activityStartupPolicy,
  identityForBoot,
  identityForMesaAccess,
  identityPresentation,
  localIdentity,
  normalizeIdentitySelection,
  participantFallbackIdentity,
  participantFallbackRemoved,
  readParticipantsSafely,
  standaloneIdentityOrNull,
  startParticipantSync,
} from './activityIdentity'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('activity identity', () => {
  it('keeps an embedded SDK startup error identity-free and blocks mesa access', () => {
    const outcome = activityStartupPolicy({ sdkAvailable: false })

    expect(outcome).toEqual({ status: 'activity-error', identity: null, fallbackReady: false })
    expect(identityForMesaAccess({ id: 'local-stale', source: 'local' }, outcome.status)).toBeNull()
  })

  it('uses authenticated Discord identity when OAuth succeeds in Activity', () => {
    const outcome = activityStartupPolicy({
      sdkAvailable: true,
      user: { id: 'verified-account', name: 'Kindred' },
    })

    expect(outcome).toEqual({
      status: 'discord',
      identity: { id: 'verified-account', discordId: 'verified-account', name: 'Kindred', source: 'discord-auth' },
      fallbackReady: false,
    })
  })

  it('allows only a real participant roster as unverified OAuth fallback', () => {
    const roster = [{ id: 'activity-user', name: 'Kindred' }]
    const available = activityStartupPolicy({
      sdkAvailable: true,
      roster,
      rosterSettled: true,
    })
    const selected = participantFallbackIdentity(roster[0], roster)
    const empty = activityStartupPolicy({ sdkAvailable: true, roster: [], rosterSettled: true })

    expect(available).toMatchObject({ status: 'discord', identity: null, fallbackReady: true })
    expect(selected).toMatchObject({ id: 'activity-user', source: 'participant' })
    expect(identityPresentation(selected, 'discord').kind).toBe('selected')
    expect(empty).toMatchObject({ status: 'activity-error', identity: null, fallbackReady: false })
    expect(participantFallbackIdentity(roster[0], [])).toBeNull()
    expect(participantFallbackIdentity({ id: 'local-forged' }, [{ id: 'local-forged' }])).toBeNull()
  })

  it('revokes a participant fallback only after an event update removes that participant', () => {
    expect(participantFallbackRemoved('selected', [{ id: 'selected' }], 'event')).toBe(false)
    expect(participantFallbackRemoved('selected', [{ id: 'someone-else' }], 'event')).toBe(true)
    expect(participantFallbackRemoved('selected', [], 'event')).toBe(true)
    expect(participantFallbackRemoved('selected', [], 'read')).toBe(false)
  })

  it('never exposes a stored Discord identity during Activity or standalone boot', () => {
    const staleDiscord = { id: 'old-discord-id', source: 'discord-auth' }
    const oldFallback = { id: 'selected-id', source: 'discord' }

    expect(identityForBoot(staleDiscord, { activity: true })).toBeNull()
    expect(identityForBoot(staleDiscord, { activity: false })).toBeNull()
    expect(identityForBoot(oldFallback, { activity: false })).toBeNull()
    expect(identityForBoot({ id: 'not-local', source: 'local' }, { activity: false })).toBeNull()
    expect(identityForBoot(staleDiscord, {
      activity: true,
      user: { id: 'current-account', name: 'Kindred' },
    })).toMatchObject({ id: 'current-account', source: 'discord-auth' })
    expect(identityForMesaAccess(staleDiscord, 'boot')).toBeNull()
  })

  it('restores only valid local identities in standalone and lets current OAuth replace them', () => {
    const local = localIdentity('Jugador', () => 'device')
    const oauthUser = { id: 'verified-account', name: 'Kindred' }

    expect(identityForBoot(local, { activity: false })).toBe(local)
    expect(identityForBoot(local, { activity: true })).toBeNull()
    expect(authenticatedIdentity({ id: 'local-forged', name: 'Local' })).toBeNull()
    expect(identityForBoot(local, { activity: true, user: oauthUser })).toMatchObject({
      id: 'verified-account',
      source: 'discord-auth',
    })
    expect(identityForMesaAccess(local, 'boot')).toBeNull()
    expect(identityForMesaAccess(local, 'standalone')).toBe(local)
  })

  it.each([
    ['participant read rejects', () => Promise.reject(new Error('participants unavailable'))],
    ['participant read times out', () => new Promise(() => {})],
  ])('keeps OAuth identity when %s', async (_label, read) => {
    let currentIdentity = null
    let persistedIdentity = null
    const verified = establishAuthenticatedIdentity(
      { id: 'private-discord-id', name: 'Kindred', accessToken: 'must-stay-in-memory' },
      (identity) => { currentIdentity = identity },
      (identity) => { persistedIdentity = identity },
    )
    expect(currentIdentity).toBe(verified)
    expect(persistedIdentity).toBe(verified)
    expect(verified).toMatchObject({ id: 'private-discord-id', source: 'discord-auth' })
    expect(verified).not.toHaveProperty('accessToken')
    const people = await readParticipantsSafely(read, {}, 5)

    expect(people).toEqual([])
    expect(identityPresentation(verified, 'discord').kind).toBe('verified')
  })

  it('keeps the authenticated identity when participants are empty', async () => {
    let currentIdentity = null
    const verified = establishAuthenticatedIdentity(
      { id: 'account-id', name: 'Kindred' },
      (identity) => { currentIdentity = identity },
      vi.fn(),
    )
    const people = await readParticipantsSafely(async () => [], {})

    expect(people).toEqual([])
    expect(verified).not.toBeNull()
    expect(currentIdentity).toBe(verified)
    expect(identityPresentation(verified, 'discord').label).toBe('Discord autenticado')
  })

  it('does not present a failed authentication or a selected participant as verified', () => {
    expect(authenticatedIdentity(null)).toBeNull()
    expect(identityPresentation(null, 'discord').kind).toBe('unverified')
    expect(identityPresentation({ id: 'participant-id', source: 'participant' }, 'discord').kind).toBe('selected')
    expect(normalizeIdentitySelection({ id: 'id', source: 'discord-auth' }, null).source).toBe('participant')
  })

  it('creates distinct local identities for separate device-local ID generators', () => {
    const first = localIdentity('Jugador', vi.fn(() => 'device-a'))
    const second = localIdentity('Jugador', vi.fn(() => 'device-b'))

    expect(first.id).not.toBe(second.id)
    expect(first.source).toBe('local')
    expect(identityPresentation(first, 'standalone').label).toContain('solo este navegador/dispositivo')
  })

  it('keeps deliberate local standalone identity but clears persisted non-local identities', () => {
    const clear = vi.fn()
    const local = localIdentity('Jugador', () => 'device')

    expect(standaloneIdentityOrNull(local, clear)).toBe(local)
    expect(clear).not.toHaveBeenCalled()
    expect(standaloneIdentityOrNull({ id: 'discord-id', source: 'discord' }, clear)).toBeNull()
    expect(standaloneIdentityOrNull({ id: 'old-id', source: 'discord-auth' }, clear)).toBeNull()
    expect(clear).toHaveBeenCalledTimes(2)
  })

  it('unsubscribes if async registration resolves after sync cancellation', async () => {
    const registration = deferred()
    const subscribed = deferred()
    const unsubscribe = vi.fn(() => Promise.reject(new Error('unsubscribe failed')))
    const sync = startParticipantSync({
      sdk: {},
      subscribe: () => {
        subscribed.resolve()
        return registration.promise
      },
      read: async () => [],
      onParticipants: vi.fn(),
      timeoutMs: 20,
    })

    await subscribed.promise
    sync.cancel()
    registration.resolve(unsubscribe)
    await sync.registered
    await sync.initialRead

    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('does not start a delayed subscription after cancellation or publish after cancel', async () => {
    const subscribe = vi.fn(() => vi.fn())
    const onParticipants = vi.fn()
    const sync = startParticipantSync({
      sdk: {},
      subscribe,
      read: async () => [{ id: 'stale' }],
      onParticipants,
      timeoutMs: 20,
    })

    sync.cancel()
    await Promise.all([sync.registered, sync.initialRead])

    expect(subscribe).not.toHaveBeenCalled()
    expect(onParticipants).not.toHaveBeenCalled()
  })

  it('keeps OAuth identity but never uses an initial roster after subscription rejection', async () => {
    let currentIdentity = null
    const verified = establishAuthenticatedIdentity(
      { id: 'verified-account', name: 'Kindred' },
      (identity) => { currentIdentity = identity },
      vi.fn(),
    )
    const onParticipants = vi.fn()
    const onRoster = vi.fn()
    const read = vi.fn(async () => [{ id: 'would-be-fallback' }])
    const sync = startParticipantSync({
      sdk: {},
      subscribe: async () => { throw new Error('subscribe failed') },
      read,
      onParticipants,
      onRoster,
      timeoutMs: 20,
    })

    const ready = await sync.subscriptionReady
    await Promise.all([sync.registered, sync.initialRead])

    expect(ready).toBe(false)
    expect(currentIdentity).toBe(verified)
    expect(identityPresentation(currentIdentity, 'discord').kind).toBe('verified')
    expect(read).not.toHaveBeenCalled()
    expect(onParticipants).not.toHaveBeenCalled()
    expect(onRoster).not.toHaveBeenCalled()
    sync.cancel()
  })

  it('does not let the initial participant read overwrite a newer subscription event', async () => {
    const fetch = deferred()
    const readStarted = deferred()
    let onChange
    const onParticipants = vi.fn()
    const sync = startParticipantSync({
      sdk: {},
      subscribe: (_sdk, callback) => {
        onChange = callback
        return () => {}
      },
      read: () => {
        readStarted.resolve()
        return fetch.promise
      },
      onParticipants,
      timeoutMs: 100,
    })

    await sync.registered
    await readStarted.promise
    onChange([{ id: 'new-roster' }])
    fetch.resolve([{ id: 'stale-roster' }])
    await sync.initialRead

    expect(onParticipants).toHaveBeenCalledOnce()
    expect(onParticipants).toHaveBeenCalledWith([{ id: 'new-roster' }])
    sync.cancel()
  })

  it('registers before the initial roster read and never overwrites an event received first', async () => {
    const order = []
    const onParticipants = vi.fn()
    const onRoster = vi.fn()
    let onChange
    const sync = startParticipantSync({
      sdk: {},
      subscribe: (_sdk, callback) => {
        order.push('subscribe')
        onChange = callback
        return Promise.resolve(() => {})
      },
      onSubscription: (ready) => {
        if (!ready) return
        order.push('event-before-read')
        onChange([{ id: 'event-roster' }])
      },
      read: async () => {
        order.push('read')
        return [{ id: 'stale-initial-roster' }]
      },
      onParticipants,
      onRoster,
      timeoutMs: 100,
    })

    await Promise.all([sync.registered, sync.initialRead])

    expect(order).toEqual(['subscribe', 'event-before-read', 'read'])
    expect(onParticipants).toHaveBeenCalledOnce()
    expect(onParticipants).toHaveBeenCalledWith([{ id: 'event-roster' }])
    expect(onRoster).toHaveBeenCalledWith({
      source: 'event',
      ok: true,
      participants: [{ id: 'event-roster' }],
    })
    sync.cancel()
  })

  it('does not enable fallback after subscription timeout even if a late subscription resolves', async () => {
    const registration = deferred()
    const subscriptionStarted = deferred()
    const cleanup = vi.fn()
    const onSubscription = vi.fn()
    const onRoster = vi.fn()
    const read = vi.fn(async () => [{ id: 'would-be-fallback' }])
    let onChange
    const sync = startParticipantSync({
      sdk: {},
      subscribe: (_sdk, callback) => {
        onChange = callback
        subscriptionStarted.resolve()
        return registration.promise
      },
      read,
      onSubscription,
      onRoster,
      timeoutMs: 5,
    })

    await subscriptionStarted.promise
    expect(await sync.subscriptionReady).toBe(false)
    await sync.initialRead
    expect(read).not.toHaveBeenCalled()
    expect(onSubscription).toHaveBeenCalledWith(false)
    expect(onRoster).not.toHaveBeenCalled()

    registration.resolve(cleanup)
    await sync.registered
    expect(cleanup).toHaveBeenCalledOnce()
    onChange([{ id: 'late-roster' }])
    expect(onSubscription).not.toHaveBeenCalledWith(true)
    expect(onRoster).not.toHaveBeenCalled()
    sync.cancel()
  })

  it('enables fallback from roster only after subscription is confirmed and fetch reconciles', async () => {
    const roster = [{ id: 'selected-identity' }]
    const onSubscription = vi.fn()
    const onRoster = vi.fn()
    const sync = startParticipantSync({
      sdk: {},
      subscribe: async () => () => {},
      read: async () => roster,
      onSubscription,
      onRoster,
      timeoutMs: 100,
    })

    await Promise.all([sync.subscriptionReady, sync.initialRead])

    expect(onSubscription).toHaveBeenCalledWith(true)
    expect(onRoster).toHaveBeenCalledWith({ source: 'read', ok: true, participants: roster })
    expect(activityStartupPolicy({
      sdkAvailable: true,
      roster: onRoster.mock.calls[0][0].participants,
      rosterSettled: true,
    }).fallbackReady).toBe(true)
    sync.cancel()
  })

  it('presents source labels without exposing identity IDs', () => {
    const verified = identityPresentation({ id: 'secret-id', source: 'discord-auth' }, 'discord')
    const selected = identityPresentation({ id: 'secret-id', source: 'participant' }, 'discord')
    const local = identityPresentation({ id: 'local-secret-id', source: 'local' }, 'standalone')
    const labels = JSON.stringify([verified, selected, local])

    expect(labels).toContain('Discord autenticado')
    expect(labels).toContain('Participante seleccionado · no autenticado')
    expect(labels).toContain('Invitado local · solo este navegador/dispositivo')
    expect(labels).not.toContain('secret-id')
  })
})
