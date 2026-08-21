import { useEffect, useMemo, useState } from 'react'
import {
  connectDiscord,
  loadIdentity,
  persistRoom,
  randomRoom,
  readParticipants,
  roomFromLocation,
  saveIdentity,
  subscribeParticipants,
} from '../lib/discord'

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || ''

export function useActivity() {
  const [sdk, setSdk] = useState(null)
  const [status, setStatus] = useState('boot')
  const [participants, setParticipants] = useState([])
  const [identity, setIdentityState] = useState(() => loadIdentity())
  const [roomId, setRoomId] = useState(() => roomFromLocation())
  const [instanceId, setInstanceId] = useState('')

  useEffect(() => {
    let cancelled = false
    let unsub = () => {}

    async function boot() {
      try {
        const next = await connectDiscord(CLIENT_ID)
        if (cancelled) return
        if (!next) {
          if (!roomFromLocation()) {
            const generated = randomRoom()
            persistRoom(generated)
            setRoomId(generated)
          }
          setStatus('standalone')
          return
        }
        setSdk(next)
        setInstanceId(next.instanceId || '')
        const room = next.instanceId || roomFromLocation() || randomRoom()
        persistRoom(room)
        setRoomId(room)
        const people = await readParticipants(next)
        if (!cancelled) setParticipants(people)
        unsub = subscribeParticipants(next, setParticipants)
        setStatus('discord')
      } catch {
        if (cancelled) return
        if (!roomFromLocation()) {
          const generated = randomRoom()
          persistRoom(generated)
          setRoomId(generated)
        }
        setStatus('standalone')
      }
    }

    boot()
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const setIdentity = (next) => {
    saveIdentity(next)
    setIdentityState(next)
  }

  const mergePlayers = (extra = []) => {
    const map = new Map()
    for (const p of [...participants, ...extra]) {
      if (p?.id) map.set(p.id, { ...map.get(p.id), ...p })
    }
    if (identity?.id) {
      map.set(identity.id, { ...map.get(identity.id), ...identity, self: true })
    }
    return Array.from(map.values())
  }

  const players = useMemo(() => mergePlayers(), [participants, identity])

  return {
    sdk,
    status,
    players,
    mergePlayers,
    participants,
    identity,
    setIdentity,
    roomId,
    instanceId,
    embedded: status === 'discord',
  }
}
