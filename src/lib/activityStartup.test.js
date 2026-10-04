import { describe, expect, it, vi } from 'vitest'
import {
  categorizedStartupError,
  loadSdkModule,
  persistRoomSafely,
  sdkUnavailableCategory,
  startupFailureCategory,
  startupSafeMessage,
  waitForSdkReady,
} from './activityStartup'
import { activityStartupPolicy, establishAuthenticatedIdentity } from './activityIdentity'

describe('safe Activity startup diagnostics', () => {
  it('keeps a connected SDK and verified identity when optional room URL persistence throws', () => {
    const sdk = { instanceId: 'instance' }
    const identitySetter = vi.fn()
    const identity = establishAuthenticatedIdentity(
      { id: 'discord-account', name: 'Kindred', accessToken: 'private-token' },
      identitySetter,
      vi.fn(),
    )
    const persistence = persistRoomSafely(() => {
      throw new Error('URL with private query data')
    }, 'room-id')

    expect(persistence).toEqual({ persisted: false, warning: 'post_connect_room_url' })
    expect(sdk.instanceId).toBe('instance')
    expect(identitySetter).toHaveBeenCalledWith(identity)
    expect(identity).toMatchObject({ id: 'discord-account', source: 'discord-auth' })
    expect(identity).not.toHaveProperty('accessToken')
    expect(activityStartupPolicy({ sdkAvailable: true, user: identity }).identity).toEqual(identity)
  })

  it('distinguishes a missing Client ID from SDK ready failures', () => {
    expect(sdkUnavailableCategory({ sdk: null, failureCategory: 'client_id_missing' })).toBe('client_id_missing')
    expect(sdkUnavailableCategory({ sdk: null })).toBe('activity_startup')
    expect(sdkUnavailableCategory({ sdk: {} })).toBe('')
    expect(startupFailureCategory(categorizedStartupError('sdk_ready_timeout'))).toBe('sdk_ready_timeout')
    expect(startupFailureCategory(categorizedStartupError('sdk_ready_rejected'))).toBe('sdk_ready_rejected')
    expect(startupSafeMessage('client_id_missing')).toContain('VITE_DISCORD_CLIENT_ID')
  })

  it('returns only safe category messages, never provider or request input', () => {
    const sensitive = 'access-token OAuth-code private-user-id https://private.invalid/path?secret=value'
    const providerError = new Error(`provider response: ${sensitive}`)
    const category = startupFailureCategory(providerError)
    const message = startupSafeMessage(category)

    expect(category).toBe('activity_startup')
    expect(message).not.toContain(sensitive)
    expect(message).not.toContain('https://')
    expect(message).not.toContain('private-user-id')
    expect(startupSafeMessage('post_connect_room_url')).not.toContain(sensitive)
  })

  it('allows the SDK handshake to finish within the 30 second limit', async () => {
    vi.useFakeTimers()
    try {
      let resolveReady
      const ready = vi.fn(() => new Promise((resolve) => { resolveReady = resolve }))
      const waiting = waitForSdkReady(ready)

      await vi.advanceTimersByTimeAsync(12_000)
      resolveReady()
      await expect(waiting).resolves.toBe(true)

      expect(ready).toHaveBeenCalledOnce()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('fails safely when the SDK handshake exceeds the 30 second limit', async () => {
    vi.useFakeTimers()
    try {
      const waiting = waitForSdkReady(() => new Promise(() => {}))
      const result = expect(waiting).rejects.toMatchObject({ startupCategory: 'sdk_ready_timeout' })
      await vi.advanceTimersByTimeAsync(30_000)
      await result

      const message = startupSafeMessage('sdk_ready_timeout')
      expect(message).toContain('handshake')
      expect(message).toContain('Reintenta')
      expect(message).not.toMatch(/client.?id|mapping|token|identity/i)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancels an SDK handshake, removes its abort listener, and ignores late readiness', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const addListener = vi.spyOn(controller.signal, 'addEventListener')
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener')
    let resolveReady
    try {
      const waiting = waitForSdkReady(() => new Promise((resolve) => { resolveReady = resolve }), {
        signal: controller.signal,
      })
      await Promise.resolve()
      controller.abort()
      await expect(waiting).resolves.toBe(false)
      resolveReady()
      await Promise.resolve()

      expect(addListener).toHaveBeenCalledWith('abort', expect.any(Function), { once: true })
      expect(removeListener).toHaveBeenCalledWith('abort', addListener.mock.calls[0][1])
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('times out a pending SDK import, classifies it safely, and clears its timer', async () => {
    vi.useFakeTimers()
    try {
      const loading = loadSdkModule(() => new Promise(() => {}), { timeoutMs: 25 })
      const result = expect(loading).rejects.toMatchObject({ startupCategory: 'sdk_import_timeout' })
      await vi.advanceTimersByTimeAsync(25)
      await result

      expect(startupSafeMessage('sdk_import_timeout')).not.toContain('access_token')
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancels a pending import so a late module cannot continue startup', async () => {
    let resolveImport
    const controller = new AbortController()
    const load = vi.fn(() => new Promise((resolve) => { resolveImport = resolve }))
    vi.useFakeTimers()
    try {
      const loading = loadSdkModule(load, { timeoutMs: 1000, signal: controller.signal })
      await Promise.resolve()
      expect(load).toHaveBeenCalledOnce()
      controller.abort()
      await expect(loading).resolves.toEqual({ module: null, cancelled: true })

      expect(vi.getTimerCount()).toBe(0)
      resolveImport({ DiscordSDK: class {} })
    } finally {
      vi.useRealTimers()
    }
  })
})
