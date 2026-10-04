import { describe, expect, it } from 'vitest'
import { getBloodRules, getHuntingInfo } from './bloodRules'

describe('getBloodRules', () => {
  it.each([
    ['15ª', 10, 1],
    ['14ª', 10, 1],
    ['13ª', 10, 1],
    ['12ª', 11, 1],
    ['11ª', 12, 1],
    ['10ª', 13, 1],
    ['9ª', 14, 2],
    ['8ª', 15, 3],
    ['7ª', 20, 4],
    ['6ª', 30, 6],
    ['5ª', 40, 8],
    ['4ª', 50, 10],
  ])('returns rule limits for generation %s', (generation, max, perTurn) => {
    expect(getBloodRules(generation)).toEqual({ generation: Number.parseInt(generation, 10), max, perTurn })
  })

  it('accepts strict canonical generation suggestions and equivalents', () => {
    expect(getBloodRules('13a')).toEqual({ generation: 13, max: 10, perTurn: 1 })
    expect(getBloodRules('13th')).toEqual({ generation: 13, max: 10, perTurn: 1 })
    expect(getBloodRules('13')).toEqual({ generation: 13, max: 10, perTurn: 1 })
    expect(getBloodRules('13ª Generación')).toEqual({ generation: 13, max: 10, perTurn: 1 })
  })

  it.each(['', '  ', '3ª', '3', '16ª', '13.ª', '13afoo', 'Generación 13', '13ª generación extra', null, {}])(
    'returns unknown limits for invalid generation %s',
    (generation) => expect(getBloodRules(generation)).toBeNull(),
  )
})

describe('getHuntingInfo', () => {
  it('uses the selected Autocontrol or Instinto value for the hunting threshold', () => {
    expect(getHuntingInfo('Autocontrol', 3, 3)).toEqual({
      virtueName: 'Autocontrol', virtueValue: 3, threshold: 4, currentBlood: 3,
      isEmpty: false, isBelowThreshold: true, isAtThreshold: false,
    })
    expect(getHuntingInfo('Instinto', 5, 2)).toEqual({
      virtueName: 'Instinto', virtueValue: 5, threshold: 2, currentBlood: 2,
      isEmpty: false, isBelowThreshold: false, isAtThreshold: true,
    })
  })

  it('distinguishes less than the threshold from the exact threshold', () => {
    expect(getHuntingInfo('Autocontrol', 2, 4).isBelowThreshold).toBe(true)
    expect(getHuntingInfo('Autocontrol', 2, 5).isAtThreshold).toBe(true)
    expect(getHuntingInfo('Autocontrol', 2, 6).isBelowThreshold).toBe(false)
  })

  it('reports an empty reserve independently of the threshold', () => {
    expect(getHuntingInfo('Instinto', 5, 0)).toMatchObject({
      threshold: 2,
      isEmpty: true,
      isBelowThreshold: true,
    })
  })

  it('returns unknown for an unsupported virtue or invalid values', () => {
    expect(getHuntingInfo('Conciencia', 3, 2)).toBeNull()
    expect(getHuntingInfo('Instinto', Number.NaN, 2)).toBeNull()
    expect(getHuntingInfo('Instinto', 6, 2)).toBeNull()
    expect(getHuntingInfo('Instinto', 3, -1)).toBeNull()
  })

  it('returns unknown instead of calculating with fractional virtue or blood values', () => {
    expect(getHuntingInfo('Autocontrol', 2.5, 3)).toBeNull()
    expect(getHuntingInfo('Instinto', 2, 3.5)).toBeNull()
  })
})
