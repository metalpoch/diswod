import { useCallback, useEffect, useState } from 'react'
import { defaultSheet } from '../lib/characterSheet'
import { deleteNpcSheet, listNpcSheets, saveSheet } from '../lib/mesasApi'

export function useNpcs(mesaId) {
  const [npcs, setNpcs] = useState([])
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    if (!mesaId) return []
    const rows = await listNpcSheets(mesaId)
    setNpcs(rows)
    setReady(true)
    return rows
  }, [mesaId])

  useEffect(() => {
    if (!mesaId) {
      setNpcs([])
      setReady(false)
      return undefined
    }
    let active = true
    setReady(false)
    refresh().catch(() => {})
    const timer = window.setInterval(() => {
      listNpcSheets(mesaId).then((rows) => {
        if (active) setNpcs(rows)
      }).catch(() => {})
    }, 5000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [mesaId, refresh])

  const create = async () => {
    const playerId = `npc-${crypto.randomUUID()}`
    const data = defaultSheet()
    data.header.nombre = 'NPC sin nombre'
    await saveSheet(mesaId, playerId, data)
    await refresh()
    return playerId
  }

  const remove = async (playerId) => {
    await deleteNpcSheet(mesaId, playerId)
    await refresh()
  }

  return { npcs, ready, create, remove, refresh }
}
