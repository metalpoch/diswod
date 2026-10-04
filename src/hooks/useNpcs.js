import { useCallback, useEffect, useRef, useState } from 'react'
import { defaultSheet } from '../lib/characterSheet'
import { deleteNpcSheet, listNpcSheets, saveSheet } from '../lib/mesasApi'
import { createRequestFreshness, createSingleFlight } from '../lib/requestFreshness'

export function useNpcs(mesaId) {
  const [npcs, setNpcs] = useState([])
  const [ready, setReady] = useState(false)
  const [rosterMesaId, setRosterMesaId] = useState('')
  const rosterRef = useRef({ mesaId: '', npcs: [] })
  const lifecycleRef = useRef(null)
  const freshnessRef = useRef(null)
  if (!freshnessRef.current) freshnessRef.current = createRequestFreshness(mesaId)
  freshnessRef.current.setContext(mesaId)
  const singleFlightRef = useRef(null)
  if (!singleFlightRef.current) singleFlightRef.current = createSingleFlight()

  const refresh = useCallback(async (force = false) => {
    if (!mesaId) return []
    const lifecycle = lifecycleRef.current
    if (!lifecycle?.active || lifecycle.mesaId !== mesaId) return []
    if (force) {
      freshnessRef.current.invalidate(mesaId)
      singleFlightRef.current.invalidate(mesaId)
    }
    return singleFlightRef.current.run(mesaId, async () => {
      if (!lifecycle?.active || lifecycle !== lifecycleRef.current || lifecycle.mesaId !== mesaId) return []
      const request = freshnessRef.current.begin(mesaId)
      if (!request) return []
      let rows
      try {
        rows = await listNpcSheets(mesaId)
      } catch (error) {
        if (lifecycle.active && lifecycleRef.current === lifecycle && freshnessRef.current.isCurrent(request)) {
          setNpcs([])
          setRosterMesaId('')
          rosterRef.current = { mesaId: '', npcs: [] }
          setReady(false)
        }
        throw error
      }
      if (!lifecycle.active || lifecycleRef.current !== lifecycle || !freshnessRef.current.isCurrent(request)) return rows
      setNpcs(rows)
      setRosterMesaId(mesaId)
      rosterRef.current = { mesaId, npcs: rows }
      setReady(true)
      return rows
    })
  }, [mesaId])

  useEffect(() => {
    const lifecycle = { mesaId, active: true }
    lifecycleRef.current = lifecycle
    if (!mesaId) {
      setNpcs([])
      setReady(false)
      setRosterMesaId('')
      rosterRef.current = { mesaId: '', npcs: [] }
      return () => { lifecycle.active = false }
    }
    freshnessRef.current.setContext(mesaId)
    setReady(false)
    setRosterMesaId('')
    rosterRef.current = { mesaId: '', npcs: [] }
    refresh().catch(() => {})
    const timer = window.setInterval(() => {
      refresh().catch(() => {})
    }, 5000)
    return () => {
      lifecycle.active = false
      freshnessRef.current.invalidate(mesaId)
      singleFlightRef.current.invalidate(mesaId)
      window.clearInterval(timer)
    }
  }, [mesaId, refresh])

  const create = async () => {
    const playerId = `npc-${crypto.randomUUID()}`
    const data = defaultSheet()
    data.header.nombre = 'NPC sin nombre'
    await saveSheet(mesaId, playerId, data)
    freshnessRef.current.invalidate(mesaId)
    const current = rosterRef.current
    if (current.mesaId === mesaId) {
      const rows = [...current.npcs, { player_id: playerId, name: data.header.nombre }]
      rosterRef.current = { mesaId, npcs: rows }
      setNpcs(rows)
    }
    await refresh()
    return playerId
  }

  const remove = async (playerId) => {
    freshnessRef.current.invalidate(mesaId)
    singleFlightRef.current.invalidate(mesaId)
    await deleteNpcSheet(mesaId, playerId)
    const current = rosterRef.current
    if (current.mesaId === mesaId) {
      const rows = current.npcs.filter((npc) => npc.player_id !== playerId)
      rosterRef.current = { mesaId, npcs: rows }
      setNpcs(rows)
    }
    await refresh(true)
  }

  const rosterCurrent = rosterMesaId === mesaId && Boolean(mesaId)
  const currentNpcs = rosterCurrent ? npcs : []
  const contains = (playerId) => rosterRef.current.mesaId === mesaId
    && rosterRef.current.npcs.some((npc) => npc.player_id === playerId)

  return {
    npcs: currentNpcs,
    ready: rosterCurrent && ready,
    rosterMesaId: rosterCurrent ? rosterMesaId : '',
    contains,
    create,
    remove,
    refresh,
  }
}
