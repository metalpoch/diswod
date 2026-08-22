import { useCallback, useEffect, useState } from 'react'
import {
  codeFromLocation,
  createMesa,
  createSession,
  getMesa,
  joinByCode,
  listMyMesas,
  listSessions,
  mesaFromLocation,
  persistMesaParam,
  setCurrentSession,
  setMesaStatus,
} from '../lib/mesasApi'
import { cleanError } from '../lib/supabase'

export function useMesas(enabled, identity) {
  const [mesas, setMesas] = useState([])
  const [current, setCurrent] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!enabled || !identity?.id) return []
    const rows = await listMyMesas(identity.id)
    setMesas(rows)
    return rows
  }, [enabled, identity?.id])

  useEffect(() => {
    if (!enabled || !identity?.id) return undefined
    let active = true
    setLoading(true)
    refresh()
      .then(async (rows) => {
        if (!active) return
        const wanted = mesaFromLocation()
        const invite = codeFromLocation()
        let found = wanted ? rows.find((m) => m.id === wanted) : null
        if (!found && invite) {
          const joined = await joinByCode(invite, identity)
          found = joined.mesa
          await refresh()
        }
        if (found) {
          setCurrent(found)
          persistMesaParam(found.id)
          setSessions(await listSessions(found.id))
        }
      })
      .catch((err) => setError(cleanError(err)))
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [enabled, identity, refresh])

  const open = async (mesa) => {
    const fresh = await getMesa(mesa.id)
    persistMesaParam(fresh.id)
    setCurrent(fresh)
    setSessions(await listSessions(fresh.id))
  }

  const close = () => {
    persistMesaParam('')
    setCurrent(null)
  }

  const create = async (fields) => {
    const mesa = await createMesa({ ...fields, identity })
    await refresh()
    await open(mesa)
    return mesa
  }

  const join = async (code) => {
    try {
      const { mesa } = await joinByCode(code, identity)
      await refresh()
      await open(mesa)
      return mesa
    } catch (err) {
      throw new Error(cleanError(err))
    }
  }

  const archive = async (mesa) => {
    await setMesaStatus(mesa.id, 'archived')
    await refresh()
    if (current?.id === mesa.id) close()
  }

  const reopen = async (mesa) => {
    const next = await setMesaStatus(mesa.id, 'active')
    await refresh()
    await open(next)
  }

  const newSession = async (title) => {
    if (!current) return null
    const session = await createSession(current.id, title)
    const mesa = await setCurrentSession(current.id, session.id)
    setCurrent(mesa)
    setSessions(await listSessions(mesa.id))
    return session
  }

  return {
    mesas,
    current,
    sessions,
    loading,
    error,
    setError,
    refresh,
    open,
    close,
    create,
    join,
    archive,
    reopen,
    newSession,
  }
}
