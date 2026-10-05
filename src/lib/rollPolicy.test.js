import { describe, expect, it, vi } from 'vitest'
import { rollBlockReason, runRollIfAllowed, shouldWaitForDm, submitRoll } from './rollPolicy'

const baseWaitContext = {
  mesaPersisted: true,
  dmId: 'dm-1',
  playerId: 'player-1',
  participants: [{ id: 'player-1' }],
  remotes: [],
}

describe('shouldWaitForDm', () => {
  it('does not wait when the Narrador is in SDK participants', () => {
    expect(shouldWaitForDm({
      ...baseWaitContext,
      participants: [...baseWaitContext.participants, { id: 'dm-1' }],
    })).toBe(false)
  })

  it('does not wait when the Narrador is in Yjs remotes', () => {
    expect(shouldWaitForDm({ ...baseWaitContext, remotes: [{ id: 'dm-1' }] })).toBe(false)
  })

  it('does not wait when the current identity is the Narrador', () => {
    expect(shouldWaitForDm({ ...baseWaitContext, playerId: 'dm-1' })).toBe(false)
  })

  it('is lenient when the participant roster is empty or unknown', () => {
    expect(shouldWaitForDm({ ...baseWaitContext, participants: [] })).toBe(false)
    expect(shouldWaitForDm({ ...baseWaitContext, participants: null })).toBe(false)
  })

  it('waits only when absence is positively confirmed for a persisted mesa', () => {
    expect(shouldWaitForDm(baseWaitContext)).toBe(true)
    expect(shouldWaitForDm({ ...baseWaitContext, mesaPersisted: false })).toBe(false)
    expect(shouldWaitForDm({ ...baseWaitContext, dmId: '' })).toBe(false)
  })
})

describe('roll blocking', () => {
  it('reports mute, waiting, and combined block reasons', () => {
    expect(rollBlockReason({ muted: true, waitingForDm: false })).toBe('El Narrador te ha silenciado.')
    expect(rollBlockReason({ muted: false, waitingForDm: true })).toBe('El Narrador no está en la mesa; las tiradas están deshabilitadas.')
    expect(rollBlockReason({ muted: true, waitingForDm: true })).toBe('Estás silenciado y el Narrador no está en la mesa.')
    expect(rollBlockReason({ muted: false, waitingForDm: false })).toBe('')
  })

  it('does not execute or log a blocked roll and returns false', () => {
    const executeParsed = vi.fn()
    const addEntry = vi.fn()
    const result = runRollIfAllowed({
      muted: false,
      waitingForDm: true,
      onAllowed: () => {
        const roll = executeParsed()
        addEntry(roll)
      },
    })

    expect(result).toBe(false)
    expect(executeParsed).not.toHaveBeenCalled()
    expect(addEntry).not.toHaveBeenCalled()
  })

  it('preserves the command when the roll handler rejects the submission', async () => {
    const onClear = vi.fn()
    const submitted = await submitRoll({ onRoll: vi.fn().mockResolvedValue(false), parsed: {}, onClear })

    expect(submitted).toBe(false)
    expect(onClear).not.toHaveBeenCalled()
  })

  it('clears the command after an accepted roll', async () => {
    const onClear = vi.fn()
    const submitted = await submitRoll({ onRoll: vi.fn().mockResolvedValue(true), parsed: {}, onClear })

    expect(submitted).toBe(true)
    expect(onClear).toHaveBeenCalledOnce()
  })
})
