import { describe, expect, it } from 'vitest'
import { createRequestFreshness, createSingleFlight } from './requestFreshness'

describe('request freshness', () => {
  it('rejects a response when a newer request for the same context has started', () => {
    const freshness = createRequestFreshness('mesa-1')
    const older = freshness.begin('mesa-1')
    const newer = freshness.begin('mesa-1')

    expect(freshness.isCurrent(older)).toBe(false)
    expect(freshness.isCurrent(newer)).toBe(true)
  })

  it('rejects outstanding responses after a context change', () => {
    const freshness = createRequestFreshness('mesa-1')
    const request = freshness.begin('mesa-1')
    freshness.setContext('mesa-2')

    expect(freshness.isCurrent(request)).toBe(false)
    expect(freshness.begin('mesa-1')).toBeNull()
    expect(freshness.isCurrent(freshness.begin('mesa-2'))).toBe(true)
  })

  it('invalidates requests started before a destructive roster change', () => {
    const freshness = createRequestFreshness('mesa-1')
    const beforeDelete = freshness.begin('mesa-1')
    freshness.invalidate('mesa-1')
    const afterDelete = freshness.begin('mesa-1')

    expect(freshness.isCurrent(beforeDelete)).toBe(false)
    expect(freshness.isCurrent(afterDelete)).toBe(true)
  })
})

describe('single-flight polling', () => {
  it('does not overlap a slow request and runs one queued refresh after it settles', async () => {
    const singleFlight = createSingleFlight()
    const pending = []
    let active = 0
    let maxActive = 0
    const task = () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      return new Promise((resolve) => {
        pending.push(() => {
          active -= 1
          resolve()
        })
      })
    }

    const first = singleFlight.run('mesa-1', task)
    const overlappingPoll = singleFlight.run('mesa-1', task)
    expect(overlappingPoll).toBe(first)
    await Promise.resolve()
    expect(pending).toHaveLength(1)
    expect(maxActive).toBe(1)

    pending[0]()
    await first
    await Promise.resolve()
    await Promise.resolve()
    expect(pending).toHaveLength(2)
    expect(maxActive).toBe(1)

    pending[1]()
    await Promise.resolve()
  })

  it('allows a new mesa request and ignores completion of the previous context', async () => {
    const singleFlight = createSingleFlight()
    const freshness = createRequestFreshness('mesa-1')
    let roster
    let finishOld
    let finishNew
    const oldRequest = singleFlight.run('mesa-1', () => {
      const ticket = freshness.begin('mesa-1')
      return new Promise((resolve) => { finishOld = (value) => resolve({ value, ticket }) })
    }).then(({ value, ticket }) => {
      if (freshness.isCurrent(ticket)) roster = value
    })
    await Promise.resolve()
    expect(finishOld).toBeTypeOf('function')
    freshness.setContext('mesa-2')
    const newRequest = singleFlight.run('mesa-2', () => {
      const ticket = freshness.begin('mesa-2')
      return new Promise((resolve) => { finishNew = (value) => resolve({ value, ticket }) })
    }).then(({ value, ticket }) => {
      if (freshness.isCurrent(ticket)) roster = value
    })
    await Promise.resolve()
    expect(finishOld).toBeTypeOf('function')
    expect(finishNew).toBeTypeOf('function')

    finishNew('new')
    await newRequest
    finishOld('old')
    await oldRequest
    expect(roster).toBe('new')
  })

  it('invalidates an NPC roster request started before deletion', async () => {
    const singleFlight = createSingleFlight()
    const freshness = createRequestFreshness('mesa-1')
    let roster = ['npc-1']
    let finishOld
    const oldRequest = singleFlight.run('mesa-1', () => {
      const ticket = freshness.begin('mesa-1')
      return new Promise((resolve) => {
        finishOld = (value) => resolve({ value, ticket })
      })
    }).then(({ value, ticket }) => {
      if (freshness.isCurrent(ticket)) roster = value
    })
    await Promise.resolve()

    freshness.invalidate('mesa-1')
    singleFlight.invalidate('mesa-1')
    roster = []
    const afterDelete = singleFlight.run('mesa-1', () => {
      const ticket = freshness.begin('mesa-1')
      return Promise.resolve({ value: [], ticket })
    }).then(({ value, ticket }) => {
      if (freshness.isCurrent(ticket)) roster = value
    })
    await afterDelete
    finishOld(['npc-1'])
    await oldRequest

    expect(roster).toEqual([])
  })
})
