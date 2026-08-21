import { describe, expect, it } from 'vitest'
import { claimSeat, seatedPlayers } from './seats'

describe('claimSeat', () => {
  it('takes the first free seat', () => {
    expect(claimSeat({ id: 'a' }, [])).toBe(0)
    expect(claimSeat({ id: 'b' }, [{ id: 'a', seat: 0 }])).toBe(1)
  })

  it('keeps a valid claimed seat', () => {
    expect(claimSeat({ id: 'a', seat: 2 }, [{ id: 'b', seat: 0 }])).toBe(2)
  })

  it('returns null when the table is full', () => {
    const remotes = [0, 1, 2, 3].map((seat) => ({ id: `p${seat}`, seat }))
    expect(claimSeat({ id: 'x' }, remotes)).toBe(null)
  })
})

describe('seatedPlayers', () => {
  it('fills four slots and resolves collisions', () => {
    const slots = seatedPlayers([
      { id: 'b', name: 'B', seat: 0 },
      { id: 'a', name: 'A', seat: 0 },
    ])
    expect(slots[0].id).toBe('a')
    expect(slots[1].id).toBe('b')
    expect(slots.filter(Boolean)).toHaveLength(2)
  })
})
