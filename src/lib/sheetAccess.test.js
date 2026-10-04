import { describe, expect, it } from 'vitest'
import {
  canEditSheet,
  canEditSheetTarget,
  canViewSheetTarget,
  isRosterReadyForMesa,
  sheetMatches,
} from './sheetAccess'

const loaded = {
  mesaId: 'mesa-1',
  playerId: 'player-1',
  ready: true,
  error: '',
}

describe('sheet access guard', () => {
  it('only considers the record for the currently selected mesa and player', () => {
    expect(sheetMatches(loaded, 'mesa-1', 'player-1')).toBe(true)
    expect(sheetMatches(loaded, 'mesa-2', 'player-1')).toBe(false)
    expect(sheetMatches(loaded, 'mesa-1', 'player-2')).toBe(false)
  })

  it('blocks edits while loading and after a failed load', () => {
    expect(canEditSheet({ ...loaded, ready: false }, 'mesa-1', 'player-1')).toBe(false)
    expect(canEditSheet({ ...loaded, error: 'No se pudo cargar' }, 'mesa-1', 'player-1')).toBe(false)
  })

  it('allows edits only after the matching record loaded successfully', () => {
    expect(canEditSheet(loaded, 'mesa-1', 'player-1')).toBe(true)
    expect(canEditSheet(loaded, 'mesa-2', 'player-1')).toBe(false)
    expect(canEditSheet(loaded, 'mesa-1', 'player-1', false)).toBe(false)
  })
})

describe('sheet target permissions', () => {
  const roster = {
    mesaId: 'mesa-1',
    targetMesaId: 'mesa-1',
    identityId: 'dm-1',
    isDm: true,
    memberIds: ['dm-1', 'player-1'],
    npcIds: ['npc-123'],
  }

  it('does not grant an old player target when the Narrator role is lost', () => {
    expect(canViewSheetTarget({ ...roster, isDm: false }, 'player-1')).toBe(false)
    expect(canEditSheetTarget({ ...roster, isDm: false }, 'player-1')).toBe(false)
  })

  it('invalidates targets selected in a different mesa', () => {
    expect(canViewSheetTarget({ ...roster, targetMesaId: 'mesa-2' }, 'player-1')).toBe(false)
    expect(canEditSheetTarget({ ...roster, targetMesaId: 'mesa-2' }, 'npc-123')).toBe(false)
  })

  it('does not treat the previous mesa roster as ready for the newly active mesa', () => {
    const oldRoster = { ready: true, rosterMesaId: 'mesa-1' }
    expect(isRosterReadyForMesa(oldRoster, 'mesa-2')).toBe(false)
    expect(isRosterReadyForMesa({ ready: false, rosterMesaId: 'mesa-2' }, 'mesa-2')).toBe(false)
    expect(isRosterReadyForMesa({ ready: true, rosterMesaId: 'mesa-2' }, 'mesa-2')).toBe(true)
    expect(canViewSheetTarget({ ...roster, mesaId: 'mesa-2', targetMesaId: 'mesa-2', isDm: false }, 'player-1')).toBe(false)
  })

  it('allows a member to edit their own sheet and the Narrator to edit an NPC', () => {
    expect(canEditSheetTarget(roster, 'dm-1')).toBe(true)
    expect(canEditSheetTarget(roster, 'npc-123')).toBe(true)
    expect(canViewSheetTarget(roster, 'player-1')).toBe(true)
  })

  it('keeps another player sheet read-only even for the Narrator', () => {
    expect(canEditSheetTarget(roster, 'player-1')).toBe(false)
  })

  it('does not allow a non-Narrator to edit an NPC sheet', () => {
    expect(canEditSheetTarget({ ...roster, isDm: false }, 'npc-123')).toBe(false)
  })

  it('revokes deferred NPC writes when the NPC disappears from the current roster', () => {
    expect(canEditSheetTarget(roster, 'npc-123')).toBe(true)
    expect(canEditSheetTarget({ ...roster, npcIds: [] }, 'npc-123')).toBe(false)
  })
})
