import { describe, expect, it } from 'vitest'
import { parseCommand } from './parser'
import {
  buildDisciplineCommand,
  buildInitiativeCommand,
  createQuickRollOrigin,
  getInitiativeBreakdown,
  getOwnedDisciplines,
  reconcileQuickRollOrigin,
} from './quickRolls'

describe('quick rolls', () => {
  it('calculates Initiative from the target sheet health, stats, and bounded manual Celerity', () => {
    const sheet = {
      header: { nombre: 'Nadia' },
      atributos: {
        fisicos: { Destreza: { v: 4 } },
        mentales: { Astucia: { v: 3 } },
      },
      disciplinas: [{ name: 'Celeridad', level: 2 }],
      salud: [1, 1, 1, 1, 0, 0, 0],
    }
    const breakdown = getInitiativeBreakdown(sheet, { unspentCelerity: 1 })

    expect(breakdown).toEqual({
      valid: true,
      dexterity: 4,
      wits: 3,
      woundPenalty: 2,
      healthValid: true,
      healthIrregular: false,
      incapacitated: false,
      celerityLevel: 2,
      unspentCelerity: 1,
      modifier: 6,
    })
    const initiative = buildInitiativeCommand(sheet, {
      unspentCelerity: 1,
      isOwn: false,
    })
    expect(initiative).toMatchObject({
      command: '/r 1d10+6 Iniciativa · Nadia · usando otra ficha; tirada registrada con la identidad de quien lanza',
      preview: expect.stringContaining('1d10+6'),
    })
    expect(parseCommand(initiative.command)).toMatchObject({ ok: true, type: 'generic', count: 1, sides: 10, modifier: 6 })
  })

  it('derives the deepest health penalty and clamps temporary Celerity to safe bounds', () => {
    const sheet = {
      atributos: { fisicos: { Destreza: 1 }, mentales: { Astucia: 0 } },
      disciplinas: [{ name: 'Celeridad', level: 1 }],
      salud: [1, 1, 1, 1, 1, 1, 0],
    }
    expect(getInitiativeBreakdown(sheet, { unspentCelerity: 99 })).toMatchObject({
      valid: true,
      woundPenalty: 5,
      unspentCelerity: 1,
      modifier: -3,
    })
    const command = buildInitiativeCommand(sheet).command
    expect(command).toContain('/r 1d10-4')
    expect(parseCommand(command)).toMatchObject({ ok: true, type: 'generic', modifier: -4 })
  })

  it('blocks normal Initiative when incapacitated and calculates separately for each selected target sheet', () => {
    const firstTarget = {
      header: { nombre: 'Nadia' },
      atributos: { fisicos: { Destreza: 3 }, mentales: { Astucia: 2 } },
      salud: [0, 0, 0, 0, 0, 0, 1],
    }
    const otherTarget = {
      header: { nombre: 'NPC' },
      atributos: { fisicos: { Destreza: 1 }, mentales: { Astucia: 1 } },
      salud: [1, 1, 1, 0, 0, 0, 0],
    }
    expect(buildInitiativeCommand(firstTarget, { targetName: 'Nadia' })).toMatchObject({ valid: false, incapacitated: true, woundPenalty: null, modifier: null, command: '', preview: '' })
    expect(buildInitiativeCommand(otherTarget, { targetName: 'NPC' })).toMatchObject({ valid: true, incapacitated: false, woundPenalty: 1, command: '/r 1d10+1 Iniciativa · NPC' })
    expect(buildInitiativeCommand(firstTarget, { targetName: 'Nadia' }).woundPenalty).toBeNull()
  })

  it('derives Initiative from the deepest box on an irregular target track without repairing it', () => {
    const target = {
      atributos: { fisicos: { Destreza: 3 }, mentales: { Astucia: 2 } },
      salud: [1, 0, 1, 0, 0, 0, 0],
    }
    const before = [...target.salud]
    expect(getInitiativeBreakdown(target)).toMatchObject({
      valid: true,
      woundPenalty: 1,
      healthValid: true,
      healthIrregular: true,
      modifier: 4,
    })
    expect(target.salud).toEqual(before)
  })

  it('does not calculate or emit initiative for malformed health vectors', () => {
    for (const salud of [[1, 0], [0, 0, 0, 0, 0, 0, 4], null, { legacy: true }]) {
      const sheet = {
        atributos: { fisicos: { Destreza: 4 }, mentales: { Astucia: 3 } },
        salud,
      }
      expect(getInitiativeBreakdown(sheet)).toMatchObject({
        valid: false,
        healthValid: false,
        woundPenalty: null,
        modifier: null,
      })
      expect(buildInitiativeCommand(sheet)).toMatchObject({ valid: false, command: '', preview: '' })
    }
  })

  it('only returns named, canonical disciplines with a positive level', () => {
    const disciplines = getOwnedDisciplines({
      disciplinas: [
        { name: ' Auspex ', level: 1 },
        { name: 'Potencia', level: 0 },
        { name: '', level: 4 },
        { name: 'Disciplina inventada', level: 5 },
        { name: 'celeridad', level: 2 },
      ],
    })
    expect(disciplines).toEqual([
      { name: 'Auspex', level: 1, index: 0 },
      { name: 'Celeridad', level: 2, index: 4 },
    ])
  })

  it('builds a configurable WOD expression, without deriving the pool from Discipline level', () => {
    const command = buildDisciplineCommand({
      count: 4,
      difficulty: 7,
      discipline: 'Auspex',
      power: 'Sentidos aguzados',
      targetName: 'Nadia',
    })
    expect(command).toBe('/r 4wod7 Auspex · Sentidos aguzados · Nadia')
    expect(parseCommand(command)).toMatchObject({
      ok: true,
      type: 'wod',
      count: 4,
      difficulty: 7,
      description: 'Auspex · Sentidos aguzados · Nadia',
    })
  })

  describe('quick-roll origin', () => {
    const origin = () => createQuickRollOrigin({ mesaId: 'mesa-a', playerId: 'player-a', text: '/r 1d10+7 Iniciativa · A' })
    const target = (mesaId = 'mesa-a', playerId = 'player-a', ready = true) => ({ mesaId, playerId, ready })

    it('invalidates and clears the generated command when the character changes', () => {
      expect(reconcileQuickRollOrigin(origin(), target('mesa-a', 'player-b'), '/r 1d10+7 Iniciativa · A')).toEqual({
        text: '',
        origin: null,
        invalidated: true,
      })
    })

    it('preserves manually edited text when the target changes', () => {
      expect(reconcileQuickRollOrigin(origin(), target('mesa-a', 'player-b'), '/r 3d10 manual')).toEqual({
        text: '/r 3d10 manual',
        origin: null,
        invalidated: true,
      })
    })

    it('keeps the command when the target is unchanged', () => {
      const command = '/r 1d10+7 Iniciativa · A'
      const savedOrigin = origin()
      expect(reconcileQuickRollOrigin(savedOrigin, target(), command)).toEqual({
        text: command,
        origin: savedOrigin,
        invalidated: false,
      })
    })

    it('invalidates the generated command when the mesa changes', () => {
      expect(reconcileQuickRollOrigin(origin(), target('mesa-b', 'player-a'), '/r 1d10+7 Iniciativa · A')).toEqual({
        text: '',
        origin: null,
        invalidated: true,
      })
    })

    it('invalidates a generated command while its target sheet is not ready', () => {
      expect(reconcileQuickRollOrigin(origin(), target('mesa-a', 'player-a', false), '/r 1d10+7 Iniciativa · A')).toMatchObject({
        text: '',
        origin: null,
        invalidated: true,
      })
    })
  })
})
