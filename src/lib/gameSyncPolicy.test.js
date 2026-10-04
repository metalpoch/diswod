import { describe, expect, it } from 'vitest'
import { canUseGameSync } from './gameSyncPolicy'

describe('game sync authorization', () => {
  it('allows a verified Discord identity or a selected Activity participant', () => {
    expect(canUseGameSync(
      { status: 'discord', embedded: true },
      { id: 'account', source: 'discord-auth' },
    )).toBe(true)
    expect(canUseGameSync(
      { status: 'discord', embedded: true },
      { id: 'participant', source: 'participant' },
    )).toBe(true)
  })

  it('allows only valid local identities after standalone is confirmed', () => {
    expect(canUseGameSync(
      { status: 'standalone', embedded: false },
      { id: 'local-device', source: 'local' },
    )).toBe(true)
    expect(canUseGameSync(
      { status: 'standalone', embedded: false },
      { id: 'not-local', source: 'local' },
    )).toBe(false)
  })

  it.each([
    ['boot', true, { id: 'account', source: 'discord-auth' }],
    ['activity-error', true, { id: 'account', source: 'discord-auth' }],
    ['discord', true, null],
    ['discord', true, { id: 'local-device', source: 'local' }],
    ['standalone', false, { id: 'account', source: 'discord-auth' }],
    ['standalone', false, null],
  ])('blocks sync in status %s / embedded=%s', (status, embedded, identity) => {
    expect(canUseGameSync({ status, embedded }, identity)).toBe(false)
  })
})
