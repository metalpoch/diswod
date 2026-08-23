import { describe, expect, it } from 'vitest'
import { parseCommand, previewCommand } from './parser'

describe('parseCommand', () => {
  it('parses generic rolls (NdS)', () => {
    expect(parseCommand('/r 1d3')).toMatchObject({ ok: true, type: 'generic', count: 1, sides: 3, modifier: 0 })
    expect(parseCommand('/r 3d10')).toMatchObject({ ok: true, type: 'generic', count: 3, sides: 10, modifier: 0 })
  })

  it('parses generic rolls with modifier', () => {
    expect(parseCommand('/r 1d10+4')).toMatchObject({ ok: true, type: 'generic', count: 1, sides: 10, modifier: 4 })
    expect(parseCommand('/r 2d6-2')).toMatchObject({ ok: true, type: 'generic', count: 2, sides: 6, modifier: -2 })
    expect(parseCommand('/r 1d3+0')).toMatchObject({ ok: true, type: 'generic', modifier: 0 })
    expect(parseCommand('/r 1d10+3 iniciativa de combate de Keiber')).toMatchObject({
      description: 'iniciativa de combate de Keiber',
    })
  })

  it('parses WOD rolls (NwodD)', () => {
    expect(parseCommand('/r 4wod6')).toMatchObject({ ok: true, type: 'wod', count: 4, difficulty: 6, specialty: false })
    expect(parseCommand('/roll 4wod6 ataque con espada')).toMatchObject({
      ok: true,
      type: 'wod',
      count: 4,
      difficulty: 6,
      description: 'ataque con espada',
    })
  })

  it('parses WOD specialty rolls (NwodD!)', () => {
    expect(parseCommand('/r 4wod6!')).toMatchObject({ ok: true, type: 'wod', count: 4, difficulty: 6, specialty: true })
    expect(parseCommand('/r 4wod6! con la especialidad').command).toBe('/r 4wod6! con la especialidad')
  })

  it('parses combined pools', () => {
    const parsed = parseCommand('/r 4wod6 + 3wod8')
    expect(parsed).toMatchObject({ ok: true, type: 'multi' })
    expect(parsed.pools).toEqual([
      { type: 'wod', count: 4, difficulty: 6, specialty: false },
      { type: 'wod', count: 3, difficulty: 8, specialty: false },
    ])
  })

  it('parses combined generic + wod pools', () => {
    const parsed = parseCommand('/r 3d10 + 2wod7')
    expect(parsed.ok).toBe(true)
    expect(parsed.pools).toEqual([
      { type: 'generic', count: 3, sides: 10, modifier: 0 },
      { type: 'wod', count: 2, difficulty: 7, specialty: false },
    ])
  })

  it('rejects invalid commands', () => {
    expect(parseCommand('/r 3d5d').ok).toBe(false)
    expect(parseCommand('/r 0d5').ok).toBe(false)
    expect(parseCommand('/r 3wod11').ok).toBe(false)
    expect(parseCommand('/r 3wod1').ok).toBe(false)
    expect(parseCommand('3d5').ok).toBe(false)
    expect(parseCommand('/r').ok).toBe(false)
  })

  it('canonicalizes the command string', () => {
    expect(parseCommand('/r 4wod6 + 3wod8').command).toBe('/r 4wod6 + 3wod8')
    expect(parseCommand('/r 1d3+0').command).toBe('/r 1d3')
  })

  it('previews valid commands', () => {
    expect(previewCommand(parseCommand('/r 4wod6 ataque'))).toContain('WOD')
    expect(previewCommand(parseCommand('/r 3d10+2 daño'))).toContain('Genérico')
    expect(previewCommand(parseCommand('/r 4wod6 + 3wod8'))).toContain('Combinada')
  })
})
