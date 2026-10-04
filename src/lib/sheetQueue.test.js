import { describe, expect, it } from 'vitest'
import { cancelPendingSheetSave, deleteNpcAfterSaving } from './sheetQueue'

describe('NPC sheet save cancellation', () => {
  it('clears the debounce and queued write, then waits for any in-flight write', async () => {
    let timerCleared = false
    let finishWrite
    let cancellationFinished = false
    const inFlight = new Promise((resolve) => { finishWrite = resolve })
    const entry = {
      timer: 42,
      pending: { data: { header: { nombre: 'NPC' } } },
      inFlight,
    }

    const cancellation = cancelPendingSheetSave(entry, (timer) => {
      expect(timer).toBe(42)
      timerCleared = true
    }).then(() => { cancellationFinished = true })

    expect(timerCleared).toBe(true)
    expect(entry.timer).toBeNull()
    expect(entry.pending).toBeNull()
    await Promise.resolve()
    expect(cancellationFinished).toBe(false)

    finishWrite()
    await cancellation
    expect(cancellationFinished).toBe(true)
  })

  it('keeps the pending draft and does not delete the NPC when saving fails', async () => {
    const calls = []
    const deleted = await deleteNpcAfterSaving({
      flushPending: async () => { calls.push('flush'); return false },
      cancelPending: async () => calls.push('cancel'),
      remove: async () => calls.push('delete'),
    })

    expect(deleted).toBe(false)
    expect(calls).toEqual(['flush'])
  })

  it('saves and drains the draft before attempting deletion; failed DELETE leaves it saved', async () => {
    const calls = []
    await expect(deleteNpcAfterSaving({
      flushPending: async () => { calls.push('flush'); return true },
      cancelPending: async () => calls.push('cancel'),
      remove: async () => {
        calls.push('delete')
        throw new Error('DELETE falló')
      },
    })).rejects.toThrow('DELETE falló')

    expect(calls).toEqual(['flush', 'cancel', 'delete'])
  })
})
