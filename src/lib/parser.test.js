import { describe, expect, it } from 'vitest'
import { parseCommand, previewCommand } from './parser'

describe('parseCommand', () => {
  it('parses WOD rolls', () => {
    expect(parseCommand('/r 3d5')).toMatchObject({ ok: true, type: 'wod', count: 3, difficulty: 5, description: '' })
    expect(parseCommand('/roll 3d5 ataque con espada')).toMatchObject({
      ok: true,
      type: 'wod',
      count: 3,
      difficulty: 5,
      description: 'ataque con espada',
    })
  })

  it('parses generic rolls', () => {
    expect(parseCommand('/r 1d10+4')).toMatchObject({ ok: true, type: 'generic', count: 1, sides: 10, modifier: 4 })
    expect(parseCommand('/r 2d6-2')).toMatchObject({ ok: true, type: 'generic', count: 2, sides: 6, modifier: -2 })
    expect(parseCommand('/r 1d3+0')).toMatchObject({ ok: true, type: 'generic', modifier: 0 })
    expect(parseCommand('/r 1d10+3 iniciativa de combate de Keiber')).toMatchObject({
      description: 'iniciativa de combate de Keiber',
    })
  })

  it('rejects invalid commands', () => {
    expect(parseCommand('/r 3d5d').ok).toBe(false)
    expect(parseCommand('/r 1d10').ok).toBe(true)
    expect(parseCommand('/r 1d10')).toMatchObject({ type: 'wod', difficulty: 10 })
    expect(parseCommand('/r 0d5').ok).toBe(false)
    expect(parseCommand('/r 3d11').ok).toBe(false)
    expect(parseCommand('3d5').ok).toBe(false)
  })

  it('previews valid commands', () => {
    expect(previewCommand(parseCommand('/r 3d5 ataque'))).toContain('WOD')
    expect(previewCommand(parseCommand('/r 4d8+2 daño crítico'))).toContain('Genérico')
  })
})
