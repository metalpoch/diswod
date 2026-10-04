import { describe, expect, it } from 'vitest'
import { bindMesaToPlayer, mesaForPlayer, mesaRequestIsCurrent } from './mesaContext'

describe('mesa identity context', () => {
  it('exposes a mesa only to the player that bound it', () => {
    const mesa = { id: 'mesa-1', name: 'Crónica' }
    const binding = bindMesaToPlayer(mesa, 'player-a')

    expect(mesaForPlayer(binding, 'player-a')).toBe(mesa)
    expect(mesaForPlayer(binding, null)).toBeNull()
    expect(mesaForPlayer(binding, 'player-b')).toBeNull()
    expect(mesaForPlayer(binding, 'player-a', false)).toBeNull()
    expect(mesaForPlayer(binding, 'player-a', true, 1)).toBeNull()
  })

  it('keeps the global request owner separate from the mesa-scoped effective player id', () => {
    const binding = bindMesaToPlayer({ id: 'legacy-mesa' }, 'discord-account', 2, 'local-legacy')

    expect(mesaForPlayer(binding, 'discord-account', true, 2)).toEqual({ id: 'legacy-mesa' })
    expect(binding).toMatchObject({ playerId: 'discord-account', effectivePlayerId: 'local-legacy' })
    expect(mesaForPlayer(binding, 'local-legacy', true, 2)).toBeNull()
  })

  it('rejects late responses from another player or an older request generation', () => {
    const request = { playerId: 'player-a', generation: 7, contextGeneration: 3 }

    expect(mesaRequestIsCurrent(request, 'player-a', 7, 3)).toBe(true)
    expect(mesaRequestIsCurrent(request, 'player-b', 7, 3)).toBe(false)
    expect(mesaRequestIsCurrent(request, 'player-a', 8, 3)).toBe(false)
    expect(mesaRequestIsCurrent(request, 'player-a', 7, 4)).toBe(false)
    expect(mesaRequestIsCurrent(request, null, 7, 3)).toBe(false)
  })

  it('hides a stale binding without mutating/deleting its mesa data', () => {
    const mesa = { id: 'mesa-1', name: 'Crónica', status: 'active' }
    const binding = bindMesaToPlayer(mesa, 'player-a')

    expect(mesaForPlayer(binding, 'player-b')).toBeNull()
    expect(binding.mesa).toBe(mesa)
    expect(mesa).toEqual({ id: 'mesa-1', name: 'Crónica', status: 'active' })
  })
})
