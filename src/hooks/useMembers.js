import { useEffect, useRef, useState } from 'react'
import { kickMember, leaveMesa, listMembers, setMemberMuted, setMemberRole, subscribeMembers } from '../lib/mesasApi'
import { proxiedUrl } from '../lib/supabase'
import { createRequestFreshness, createSingleFlight } from '../lib/requestFreshness'

function proxyMembers(rows) {
  return rows.map((m) => ({
    ...m,
    avatar: proxiedUrl(m.avatar),
    photo: proxiedUrl(m.photo),
  }))
}

export function useMembers(mesaId, identity) {
  const [members, setMembers] = useState([])
  const [ready, setReady] = useState(false)
  const [rosterMesaId, setRosterMesaId] = useState('')
  const freshnessRef = useRef(null)
  if (!freshnessRef.current) freshnessRef.current = createRequestFreshness(mesaId)
  freshnessRef.current.setContext(mesaId)
  const singleFlightRef = useRef(null)
  if (!singleFlightRef.current) singleFlightRef.current = createSingleFlight()

  useEffect(() => {
    if (!mesaId) {
      setMembers([])
      setReady(false)
      setRosterMesaId('')
      return undefined
    }
    let active = true
    freshnessRef.current.setContext(mesaId)
    singleFlightRef.current.invalidate(mesaId)
    setReady(false)
    setRosterMesaId('')
    const clearRoster = () => {
      setMembers([])
      setRosterMesaId('')
      setReady(false)
    }
    const requestRoster = () => singleFlightRef.current.run(mesaId, async () => {
      if (!active) return []
      const request = freshnessRef.current.begin(mesaId)
      if (!request) return []
      try {
        const rows = await listMembers(mesaId)
        if (active && freshnessRef.current.isCurrent(request)) {
          setMembers(proxyMembers(rows))
          setRosterMesaId(mesaId)
          setReady(true)
        }
        return rows
      } catch (error) {
        if (active && freshnessRef.current.isCurrent(request)) clearRoster()
        throw error
      }
    })
    requestRoster().catch(() => {})
    const stop = subscribeMembers(mesaId, () => {
      if (!active) return
      freshnessRef.current.invalidate(mesaId)
      clearRoster()
      requestRoster().catch(() => {})
    })
    const timer = window.setInterval(() => {
      requestRoster().catch(() => {})
    }, 3000)
    return () => {
      active = false
      stop()
      freshnessRef.current.invalidate(mesaId)
      singleFlightRef.current.invalidate(mesaId)
      window.clearInterval(timer)
    }
  }, [mesaId])

  const rosterCurrent = Boolean(mesaId && rosterMesaId === mesaId)
  const currentMembers = rosterCurrent ? members : []
  const currentReady = rosterCurrent && ready
  const me = currentMembers.find((m) => m.player_id === identity?.id) || null
  const kicked = Boolean(mesaId && currentReady && identity?.id && !me)

  return {
    members: currentMembers,
    rosterMesaId: rosterCurrent ? rosterMesaId : '',
    me,
    ready: currentReady,
    kicked,
    isDm: currentReady && me?.role === 'dm',
    isPlayer: currentReady && (me?.role === 'dm' || me?.role === 'player'),
    setRole: (playerId, role) => setMemberRole(mesaId, playerId, role, currentMembers),
    setMuted: (playerId, muted) => setMemberMuted(mesaId, playerId, muted),
    kick: (playerId) => kickMember(mesaId, playerId),
    leave: () => leaveMesa(mesaId, identity, currentMembers),
  }
}
