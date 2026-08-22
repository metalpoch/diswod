import { useEffect, useRef, useState } from 'react'
import { loadLog, loadLogSince, saveLogEntry, subscribeLog } from '../lib/mesasApi'
import { createGameSync } from '../lib/sync'

function mergeEntries(left, right) {
  const map = new Map()
  for (const entry of [...left, ...right]) {
    if (entry?.id) map.set(entry.id, entry)
  }
  return Array.from(map.values()).sort((a, b) => a.ts - b.ts)
}

export function useGameLog(roomId, identity, persist) {
  const [live, setLive] = useState([])
  const [stored, setStored] = useState([])
  const [remotes, setRemotes] = useState([])
  const [peers, setPeers] = useState(1)
  const [connected, setConnected] = useState(false)
  const syncRef = useRef(null)
  const saved = useRef(new Set())

  useEffect(() => {
    if (!roomId) return undefined
    const sync = createGameSync(roomId, (state) => {
      setLive(state.entries)
      setRemotes(state.remotes || [])
      setPeers(state.peers)
      setConnected(state.connected)
    })
    syncRef.current = sync
    if (identity) sync.setAwareness(identity)
    return () => {
      sync.destroy()
      syncRef.current = null
    }
  }, [roomId])

  useEffect(() => {
    if (identity) syncRef.current?.setAwareness(identity)
  }, [identity])

  useEffect(() => {
    if (!persist?.enabled || !persist.mesaId) {
      setStored([])
      saved.current = new Set()
      return undefined
    }
    let active = true
    let lastTs = 0
    loadLog(persist.mesaId).then((rows) => {
      if (!active) return
      setStored(rows)
      saved.current = new Set(rows.map((row) => row.id))
      if (rows.length) lastTs = Math.max(...rows.map((row) => row.ts || 0))
    }).catch(() => {})
    const stop = subscribeLog(persist.mesaId, (entry) => {
      saved.current.add(entry.id)
      if (entry.ts) lastTs = Math.max(lastTs, entry.ts)
      setStored((prev) => mergeEntries(prev, [entry]))
    })
    const timer = window.setInterval(() => {
      if (!active) return
      const since = lastTs ? new Date(Math.max(0, lastTs - 1000)).toISOString() : undefined
      loadLogSince(persist.mesaId, since)
        .then((rows) => {
          if (!active || !rows?.length) return
          setStored((prev) => mergeEntries(prev, rows))
          for (const row of rows) {
            saved.current.add(row.id)
            if (row.ts) lastTs = Math.max(lastTs, row.ts)
          }
        })
        .catch(() => {})
    }, 2500)
    return () => {
      active = false
      stop()
      window.clearInterval(timer)
    }
  }, [persist?.enabled, persist?.mesaId])

  useEffect(() => {
    if (!persist?.enabled || !persist.mesaId) return
    for (const entry of live) {
      if (saved.current.has(entry.id)) continue
      saved.current.add(entry.id)
      saveLogEntry(persist.mesaId, persist.sessionId, entry).catch(() => {
        saved.current.delete(entry.id)
      })
    }
  }, [live, persist?.enabled, persist?.mesaId, persist?.sessionId])

  const addEntry = (entry) => {
    const tagged = persist?.sessionId ? { ...entry, sessionId: persist.sessionId } : entry
    syncRef.current?.add(tagged)
  }

  const clear = () => {
    syncRef.current?.clear()
  }

  const renamePlayer = (playerId, name) => {
    syncRef.current?.renamePlayer(playerId, name)
  }

  return {
    entries: mergeEntries(stored, live),
    remotes,
    peers,
    connected,
    addEntry,
    clear,
    renamePlayer,
  }
}
