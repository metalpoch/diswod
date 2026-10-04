import { describe, expect, it } from 'vitest'
import {
  addHealthDamage,
  healthCounts,
  isCanonicalHealth,
  isValidHealth,
  removeHealthDamage,
  summarizeHealth,
} from './healthTrack'
import { normalizeSheet } from './characterSheet'
import { buildInitiativeCommand } from './quickRolls'

describe('V20 health track', () => {
  it('uses only the deepest occupied box for the penalty, never adds penalties', () => {
    expect(summarizeHealth([1, 0, 1, 0, 0, 0, 0])).toMatchObject({
      level: 'Lesionado',
      levelIndex: 2,
      penalty: 1,
      irregular: true,
    })
    expect(summarizeHealth([1, 1, 1, 1, 1, 1, 0]).penalty).toBe(5)
    expect(summarizeHealth([0, 0, 0, 0, 0, 0, 1])).toMatchObject({
      level: 'Incapacitado',
      penalty: null,
      incapacitated: true,
    })
    expect(summarizeHealth([0, 0, 0, 0, 0, 0, 0])).toMatchObject({ level: 'Sin heridas', penalty: 0 })
  })

  it('applies damage using canonical aggravated, lethal, bashing order without mutating input', () => {
    const health = [2, 1, 1, 0, 0, 0, 0]
    const result = addHealthDamage(health, 3)
    expect(result).toMatchObject({ ok: true, health: [3, 2, 1, 1, 0, 0, 0], afterCounts: { contundente: 2, letal: 1, agravado: 1 } })
    expect(health).toEqual([2, 1, 1, 0, 0, 0, 0])
  })

  it('requires preview confirmation for gapped or out-of-order damage and cancellation preserves the exact vector', () => {
    for (const health of [[1, 0, 2, 0, 0, 0, 0], [1, 2, 0, 0, 0, 0, 0]]) {
      const original = [...health]
      const pending = addHealthDamage(health, 1)
      expect(pending).toMatchObject({ ok: false, requiresConfirmation: true, preview: expect.any(Array) })
      expect(pending.beforeCounts).toEqual(healthCounts(original))
      expect(pending.afterCounts.contundente).toBe(pending.beforeCounts.contundente + 1)
      // Cancel is represented by not applying the preview; neither helper nor caller input is mutated.
      expect(health).toEqual(original)
    }
    expect(addHealthDamage([1, 0, 2, 0, 0, 0, 0], 1, { confirmed: true }).health).toEqual([2, 1, 1, 0, 0, 0, 0])
  })

  it('does not change a full track and does not wrap or overwrite', () => {
    const full = [3, 3, 2, 2, 1, 1, 1]
    expect(addHealthDamage(full, 3)).toMatchObject({ ok: false, health: null, reason: expect.stringContaining('7 casillas') })
    expect(full).toEqual([3, 3, 2, 2, 1, 1, 1])
  })

  it('removes only the selected damage type and previews compaction before moving marks', () => {
    const health = [3, 2, 1, 1, 0, 0, 0]
    const result = removeHealthDamage(health, 2)
    expect(result).toMatchObject({ requiresConfirmation: true, preview: [3, 1, 1, 0, 0, 0, 0] })
    expect(result.beforeCounts).toEqual({ contundente: 2, letal: 1, agravado: 1 })
    expect(result.afterCounts).toEqual({ contundente: 2, letal: 0, agravado: 1 })
    expect(health).toEqual([3, 2, 1, 1, 0, 0, 0])
    expect(removeHealthDamage(health, 2, { confirmed: true }).health).toEqual([3, 1, 1, 0, 0, 0, 0])
    expect(removeHealthDamage([3, 2, 1, 0, 0, 0, 0], 1)).toMatchObject({ ok: true, health: [3, 2, 0, 0, 0, 0, 0] })
  })

  it('rejects malformed vectors for automatic operations and preserves all seven slots on round-trip', () => {
    for (const health of [[0, 0, 0], [0, 0, 0, 0, 0, 0, 4], [0, 0, 0, 0, 0, 0, 1.5]]) {
      expect(isValidHealth(health)).toBe(false)
      expect(addHealthDamage(health, 1)).toMatchObject({ ok: false, health: null })
      expect(removeHealthDamage(health, 1)).toMatchObject({ ok: false, health: null })
    }
    const health = [0, 0, 0, 0, 0, 0, 0]
    const result = addHealthDamage(health, 2)
    expect(result.health).toHaveLength(7)
    expect(isValidHealth(result.health)).toBe(true)
    expect(isCanonicalHealth(result.health)).toBe(true)
  })

  it('preserves tracks longer than seven slots and rejects damage and Initiative instead of treating them as empty', () => {
    const rawHealth = [0, 1, 0, 0, 0, 0, 0, 2]
    const sheet = normalizeSheet({ salud: rawHealth })

    expect(sheet.salud).toEqual(rawHealth)
    expect(normalizeSheet(sheet).salud).toEqual(rawHealth)
    expect(summarizeHealth(sheet.salud)).toMatchObject({ valid: false, penalty: null })
    expect(addHealthDamage(sheet.salud, 1)).toMatchObject({ ok: false, health: null })
    expect(buildInitiativeCommand(sheet)).toMatchObject({ valid: false, command: '', preview: '' })
  })

})
