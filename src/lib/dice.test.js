import { describe, expect, it } from 'vitest'
import { defaultRng, executeParsed, formatGenericLine, formatWodLine, rollGeneric, rollWod } from './dice'
import { parseCommand } from './parser'

function seq(values) {
  const copy = [...values]
  return () => {
    if (!copy.length) throw new Error('rng exhausted')
    return copy.shift()
  }
}

describe('defaultRng', () => {
  it('stays within bounds for common dice', () => {
    for (const sides of [2, 4, 6, 8, 10, 12, 20, 100]) {
      for (let i = 0; i < 200; i += 1) {
        const value = defaultRng(sides)
        expect(value).toBeGreaterThanOrEqual(1)
        expect(value).toBeLessThanOrEqual(sides)
      }
    }
  })

  it('produces varied values for a d10', () => {
    const seen = new Set()
    for (let i = 0; i < 100; i += 1) seen.add(defaultRng(10))
    expect(seen.size).toBeGreaterThanOrEqual(6)
  })
})

describe('rollWod', () => {
  it('counts successes against difficulty', () => {
    const result = rollWod(3, 5, seq([8, 6, 5]))
    expect(result.successes).toBe(3)
    expect(result.failures).toBe(0)
    expect(formatWodLine({ ...result, description: '' })).toBe('Roll: [8, 6, 5] = 3 successes (0 failures)')
  })

  it('uses description in the line', () => {
    const result = rollWod(3, 5, seq([8, 6, 5]))
    expect(formatWodLine({ ...result, description: 'Ataque con espada' })).toBe(
      'Ataque con espada: [8, 6, 5] = 3 successes (0 failures)',
    )
  })

  it('explodes tens and cancels ones', () => {
    const result = rollWod(2, 6, seq([10, 1, 8]))
    expect(result.values).toEqual([10, 1, 8])
    expect(result.rawSuccesses).toBe(2)
    expect(result.successes).toBe(1)
    expect(result.dice[2].exploded).toBe(true)
  })

  it('flags a botch when there are ones and no successes', () => {
    const result = rollWod(3, 8, seq([1, 2, 3]))
    expect(result.botch).toBe(true)
    expect(result.successes).toBe(0)
  })
})

describe('rollGeneric', () => {
  it('formats a single die', () => {
    const result = rollGeneric(1, 10, 4, seq([8]))
    expect(result.total).toBe(12)
    expect(formatGenericLine({ ...result, description: '' })).toBe('Resultado: 12 (Dados: 8 + Mod: 4)')
  })

  it('formats several dice and a description', () => {
    const result = rollGeneric(3, 6, 1, seq([4, 6, 3]))
    expect(formatGenericLine({ ...result, description: 'Iniciativa de combate de Keiber' })).toBe(
      'Iniciativa de combate de Keiber: 14 (Dados: [4, 6, 3] + Mod: 1)',
    )
  })
})

describe('executeParsed', () => {
  it('rolls from a parsed WOD command', () => {
    const result = executeParsed(parseCommand('/r 3d5 ataque con espada'), seq([8, 6, 5]))
    expect(result.command).toBe('/r 3d5 ataque con espada')
    expect(formatWodLine(result)).toBe('ataque con espada: [8, 6, 5] = 3 successes (0 failures)')
  })
})
