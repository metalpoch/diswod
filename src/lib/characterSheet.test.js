import { describe, expect, it } from 'vitest'
import {
  ATRIBUTOS,
  HABILIDADES,
  HEALTH_LEVELS,
  normalizeSheet,
  defaultSheet,
} from './characterSheet'

describe('defaultSheet', () => {
  it('has the full V20 structure', () => {
    const sheet = defaultSheet()
    expect(Object.keys(sheet.atributos)).toEqual(['fisicos', 'sociales', 'mentales'])
    expect(Object.keys(sheet.habilidades)).toEqual(['talentos', 'tecnicas', 'conocimientos'])
    expect(sheet.atributos.fisicos.Fuerza).toEqual({ v: 0, spec: '' })
    expect(sheet.habilidades.talentos.Alerta).toEqual({ v: 0, spec: '' })
    expect(sheet.virtudes.coraje).toBe(0)
    expect(sheet.disciplinas).toHaveLength(6)
    expect(sheet.trasfondos).toHaveLength(6)
    expect(sheet.meritos).toHaveLength(5)
    expect(sheet.defectos).toHaveLength(5)
    expect(sheet.salud).toHaveLength(7)
  })

  it('every stat in the definitions has a default entry', () => {
    const sheet = defaultSheet()
    for (const [group, keys] of Object.entries(ATRIBUTOS)) {
      for (const key of keys) expect(sheet.atributos[group][key]).toEqual({ v: 0, spec: '' })
    }
    for (const [group, keys] of Object.entries(HABILIDADES)) {
      for (const key of keys) expect(sheet.habilidades[group][key]).toEqual({ v: 0, spec: '' })
    }
  })

  it('has the reference PDF defaults', () => {
    const sheet = defaultSheet()
    expect(sheet.senda.nombre).toBe('Humanidad')
    expect(sheet.header.porte).toBe('Resolución')
    expect(sheet.virtudes.concienciaNombre).toBe('Conciencia')
    expect(sheet.virtudes.autocontrolNombre).toBe('Autocontrol')
  })
})

describe('normalizeSheet', () => {
  it('fills missing fields from defaults', () => {
    const sheet = normalizeSheet({ header: { nombre: 'Keiber' } })
    expect(sheet.header.nombre).toBe('Keiber')
    expect(sheet.header.clan).toBe('')
    expect(sheet.atributos.fisicos.Fuerza).toEqual({ v: 0, spec: '' })
    expect(sheet.disciplinas).toHaveLength(6)
    expect(sheet.salud).toHaveLength(HEALTH_LEVELS.length)
  })

  it('migrates old numeric stats into {v, spec}', () => {
    const sheet = normalizeSheet({ atributos: { fisicos: { Fuerza: 3 } }, habilidades: { talentos: { Alerta: 2 } } })
    expect(sheet.atributos.fisicos.Fuerza).toEqual({ v: 3, spec: '' })
    expect(sheet.habilidades.talentos.Alerta).toEqual({ v: 2, spec: '' })
  })

  it('keeps specialty strings and clamps values', () => {
    const sheet = normalizeSheet({
      atributos: { fisicos: { Fuerza: { v: 9, spec: 'Brazos Potentes' } } },
      salud: [9, 9, 9, 9, 9, 9, 9],
    })
    expect(sheet.atributos.fisicos.Fuerza).toEqual({ v: 9, spec: 'Brazos Potentes' })
    expect(sheet.salud.every((n) => n <= 3)).toBe(true)
  })

  it('normalizes named lists', () => {
    const sheet = normalizeSheet({ disciplinas: [{ name: 'Potencia', level: 4 }, null] })
    expect(sheet.disciplinas[0]).toEqual({ name: 'Potencia', level: 4 })
    expect(sheet.disciplinas[1]).toEqual({ name: '', level: 0 })
  })

  it('returns a default sheet for null input', () => {
    expect(normalizeSheet(null)).toEqual(defaultSheet())
  })
})
