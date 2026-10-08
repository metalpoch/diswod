import { describe, expect, it, vi } from 'vitest'
import {
  createDmPresencePoller,
  createDmPresenceRequestGuard,
  dmPresenceContext,
  dmPresenceNotice,
  dmPresencePositiveSignal,
  dmPresenceRosterKey,
} from './dmPresence'

describe('DM presence client policy helpers', () => {
  it('keeps request responses bound to the captured mesa, player, roster, and generation', () => {
    const captured = dmPresenceContext({
      mesaId: 'mesa-a',
      playerId: 'player-a',
      participants: [{ id: '100000000000000001' }],
      generation: 3,
      oauthAccessToken: 'token-a',
    })
    let current = { ...captured }
    const isCurrent = createDmPresenceRequestGuard(captured, () => current)
    expect(isCurrent()).toBe(true)
    current = { ...captured, mesaId: 'mesa-b' }
    expect(isCurrent()).toBe(false)
    current = { ...captured, playerId: 'player-b' }
    expect(isCurrent()).toBe(false)
    current = { ...captured, participantKey: '100000000000000002' }
    expect(isCurrent()).toBe(false)
    current = { ...captured, generation: 4 }
    expect(isCurrent()).toBe(false)
    current = { ...captured, oauthAccessToken: 'token-b' }
    expect(isCurrent()).toBe(false)
  })

  it('uses exact direct/Yjs IDs as positive signals and shows an actionable unlinked notice only in a mesa', () => {
    expect(dmPresencePositiveSignal({ dmId: 'local-dm', playerId: 'player', participants: [{ id: 'local-dm-suffix' }], remotes: [] })).toBe(false)
    expect(dmPresencePositiveSignal({ dmId: 'local-dm', playerId: 'player', participants: [], remotes: [{ id: 'local-dm' }] })).toBe(true)
    const unlinkedNotice = dmPresenceNotice({
      status: 'unlinked',
      mesaPersisted: true,
      hasRoster: true,
      isDm: false,
      positiveSignal: false,
    })
    expect(unlinkedNotice).toBe('El Narrador aún no vinculó su cuenta de Discord; no podemos verificar su presencia. Pídele reclamar la fila Narrador.')
    expect(dmPresenceNotice({ status: 'unlinked', mesaPersisted: false, hasRoster: true, isDm: false, positiveSignal: false })).toBe('')
    expect(dmPresenceNotice({ status: 'unlinked', mesaPersisted: true, hasRoster: true, isDm: true, positiveSignal: false })).toBe('')
    expect(dmPresenceNotice({ status: 'unlinked', mesaPersisted: true, hasRoster: true, isDm: false, positiveSignal: true })).toBe('')
    expect(dmPresenceNotice({ status: 'unknown', mesaPersisted: true, hasRoster: true, isDm: false, positiveSignal: false }))
      .toContain('presencia del Narrador no es verificable')
    expect(dmPresenceNotice({ status: 'unknown', mesaPersisted: false, hasRoster: true, isDm: false, positiveSignal: false })).toBe('')
  })

  it('changes the request context for roster overflow and malformed participant entries', () => {
    const one = dmPresenceRosterKey([{ id: '100000000000000001' }])
    expect(dmPresenceRosterKey(Array(65).fill({ id: '100000000000000001' }))).not.toBe(one)
    expect(dmPresenceRosterKey([{ id: 'invalid' }])).not.toBe(dmPresenceRosterKey([]))
  })

  it('releases a timed-out poll cycle and ignores its late response after a newer poll', async () => {
    vi.useFakeTimers()
    let resolveOld
    const request = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
      .mockResolvedValueOnce('online')
    const onResult = vi.fn()
    const poller = createDmPresencePoller({ request, isCurrent: () => true, onResult, timeoutMs: 50 })

    try {
      expect(poller.poll()).toBe(true)
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(50)
      expect(onResult).toHaveBeenLastCalledWith('unknown')
      expect(poller.poll()).toBe(true)
      await vi.advanceTimersByTimeAsync(0)
      expect(onResult).toHaveBeenLastCalledWith('online')

      resolveOld('offline')
      await Promise.resolve()
      await Promise.resolve()
      expect(onResult.mock.calls.map(([status]) => status)).toEqual(['unknown', 'online'])
      expect(request).toHaveBeenCalledTimes(2)
    } finally {
      poller.cancel()
      vi.useRealTimers()
    }
  })
})
