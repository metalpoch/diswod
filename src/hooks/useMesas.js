import { useCallback, useEffect, useState } from 'react'
import {
  codeFromLocation,
  createMesa,
  getMesa,
  joinByCode,
  listMyMesas,
  mesaFromLocation,
  persistMesaParam,
  setMesaStatus,
} from '../lib/mesasApi'
import { cleanError } from '../lib/supabase'

export function useMesas(enabled, identity) {
  const [mesas, setMesas] = useState([])
  const [current, setCurrent] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingCharName, setPendingCharName] = useState(false)

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
          if (joined.isNew) setPendingCharName(true)
          await refresh()
        }
        if (found) {
          setCurrent(found)
          persistMesaParam(found.id)
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
  }

  const close = () => {
    persistMesaParam('')
    setCurrent(null)
    setPendingCharName(false)
  }

  const create = async (fields) => {
    const mesa = await createMesa({ ...fields, identity })
    await refresh()
    await open(mesa)
    return mesa
  }

  const join = async (code) => {
    try {
      const { mesa, isNew } = await joinByCode(code, identity)
      if (isNew) setPendingCharName(true)
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

  return {
    mesas,
    current,
    loading,
    error,
    setError,
    pendingCharName,
    dismissCharName: () => setPendingCharName(false),
    refresh,
    open,
    close,
    create,
    join,
    archive,
    reopen,
  }
}
