import { useEffect, useRef, useState } from 'react'
import { createGameSync } from '../lib/sync'

export function useGameLog(roomId, identity) {
  const [entries, setEntries] = useState([])
  const [remotes, setRemotes] = useState([])
  const [peers, setPeers] = useState(1)
  const [connected, setConnected] = useState(false)
  const syncRef = useRef(null)

  useEffect(() => {
    if (!roomId) return undefined
    const sync = createGameSync(roomId, (state) => {
      setEntries(state.entries)
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

  const addEntry = (entry) => {
    syncRef.current?.add(entry)
  }

  const clear = () => {
    syncRef.current?.clear()
  }

  return { entries, remotes, peers, connected, addEntry, clear }
}
