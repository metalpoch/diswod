import { useEffect, useState } from 'react'
import { kickMember, leaveMesa, listMembers, setMemberMuted, setMemberRole, subscribeMembers } from '../lib/mesasApi'

export function useMembers(mesaId, identity) {
  const [members, setMembers] = useState([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!mesaId) {
      setMembers([])
      setReady(false)
      return undefined
    }
    let active = true
    setReady(false)
    listMembers(mesaId)
      .then((rows) => {
        if (!active) return
        setMembers(rows)
        setReady(true)
      })
      .catch(() => {
        if (active) setReady(false)
      })
    const stop = subscribeMembers(mesaId, (rows) => {
      if (active) setMembers(rows)
    })
    const timer = window.setInterval(() => {
      listMembers(mesaId)
        .then((rows) => {
          if (active) setMembers(rows)
        })
        .catch(() => {})
    }, 3000)
    return () => {
      active = false
      stop()
      window.clearInterval(timer)
    }
  }, [mesaId])

  const me = members.find((m) => m.player_id === identity?.id) || null
  const kicked = Boolean(mesaId && ready && identity?.id && !me)

  return {
    members,
    me,
    ready,
    kicked,
    isDm: me?.role === 'dm',
    isPlayer: me?.role === 'dm' || me?.role === 'player',
    setRole: (playerId, role) => setMemberRole(mesaId, playerId, role, members),
    setMuted: (playerId, muted) => setMemberMuted(mesaId, playerId, muted),
    kick: (playerId) => kickMember(mesaId, playerId),
    leave: () => leaveMesa(mesaId, identity, members),
  }
}
