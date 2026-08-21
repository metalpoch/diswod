import { describe, expect, it } from 'vitest'
import { isChronicler, normalizeKey, parseAllowlist } from './allowlist'

describe('allowlist', () => {
  it('normalizes names', () => {
    expect(normalizeKey(' Keíber ')).toBe('keiber')
  })

  it('parses a list', () => {
    expect(parseAllowlist('keiber, Poch;Amigo')).toEqual(['keiber', 'poch', 'amigo'])
  })

  it('matches name or id', () => {
    const list = ['keiber', '123']
    expect(isChronicler({ name: 'Keiber', id: 'local-1' }, list)).toBe(true)
    expect(isChronicler({ name: 'Otro', id: '123' }, list)).toBe(true)
    expect(isChronicler({ name: 'Invitado', id: 'x' }, list)).toBe(false)
  })
})
