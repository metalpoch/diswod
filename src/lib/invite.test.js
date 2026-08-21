import { describe, expect, it } from 'vitest'
import { canPromote, isSeatedRole, normalizeInvite, seatedCount } from './invite'
import { seatedFromMembers } from './seats'

describe('invite', () => {
  it('normalizes codes', () => {
    expect(normalizeInvite(' ab-12cd ')).toBe('AB12CD')
  })

  it('counts seated roles', () => {
    const members = [
      { role: 'dm' },
      { role: 'player' },
      { role: 'visitor' },
      { role: 'player' },
    ]
    expect(seatedCount(members)).toBe(3)
    expect(canPromote(members)).toBe(true)
    expect(isSeatedRole('visitor')).toBe(false)
  })
})

describe('seatedFromMembers', () => {
  it('puts the DM first and ignores visitors', () => {
    const seats = seatedFromMembers([
      { player_id: 'v', player_name: 'Visit', role: 'visitor' },
      { player_id: 'p', player_name: 'P', role: 'player' },
      { player_id: 'd', player_name: 'DM', role: 'dm' },
    ])
    expect(seats[0].id).toBe('d')
    expect(seats[1].id).toBe('p')
    expect(seats.filter(Boolean)).toHaveLength(2)
  })
})
