import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { defaultSheet, normalizeSheet } from '../lib/characterSheet'
import { canEditSheet, sheetMatches } from '../lib/sheetAccess'
import { cancelPendingSheetSave } from '../lib/sheetQueue'
import { loadSheet, saveSheet } from '../lib/mesasApi'

const LOAD_ERROR = 'No se pudo cargar la ficha. No se guardaron cambios; inténtalo de nuevo.'

function resourceKey(mesaId, playerId) {
  return JSON.stringify([mesaId || '', playerId || ''])
}

export function useSheet(mesaId, playerId, canEdit = false) {
  const [record, setRecord] = useState(() => ({
    mesaId,
    playerId,
    data: defaultSheet(),
    ready: false,
    status: '',
    error: '',
  }))
  const [retry, setRetry] = useState(0)
  const recordRef = useRef(record)
  const savesRef = useRef(new Map())
  const editLocksRef = useRef(new Set())
  const permission = typeof canEdit === 'function' ? canEdit : () => Boolean(canEdit)
  const permissionRef = useRef(() => false)
  const hasResource = Boolean(mesaId && playerId)

  useLayoutEffect(() => {
    permissionRef.current = permission
  }, [permission])

  useEffect(() => {
    let active = true
    const loading = {
      mesaId,
      playerId,
      data: defaultSheet(),
      ready: false,
      status: 'Cargando ficha…',
      error: '',
    }
    recordRef.current = loading
    setRecord(loading)

    if (!mesaId || !playerId) {
      const empty = { ...loading, status: '' }
      recordRef.current = empty
      setRecord(empty)
      return () => { active = false }
    }

    loadSheet(mesaId, playerId)
      .then((row) => {
        if (!active) return
        const loaded = {
          mesaId,
          playerId,
          data: normalizeSheet(row?.data),
          ready: true,
          status: '',
          error: '',
        }
        recordRef.current = loaded
        setRecord(loaded)
      })
      .catch(() => {
        if (!active) return
        const failed = {
          mesaId,
          playerId,
          data: defaultSheet(),
          ready: true,
          status: '',
          error: LOAD_ERROR,
        }
        recordRef.current = failed
        setRecord(failed)
      })

    return () => { active = false }
  }, [mesaId, playerId, retry])

  const updateStatus = (targetKey, status) => {
    const current = recordRef.current
    if (resourceKey(current.mesaId, current.playerId) !== targetKey) return
    const next = { ...current, status }
    recordRef.current = next
    setRecord(next)
  }

  const savePending = (targetKey, entry) => {
    if (entry.saving || entry.timer || !entry.pending) return
    if (!permissionRef.current?.(entry.mesaId, entry.playerId)) {
      entry.pending = null
      savesRef.current.delete(targetKey)
      updateStatus(targetKey, 'Guardado cancelado')
      return
    }
    const pending = entry.pending
    entry.pending = null
    entry.saving = true
    const operation = saveSheet(entry.mesaId, entry.playerId, pending.data)
      .then(() => {
        entry.saving = false
        if (entry.pending) {
          savePending(targetKey, entry)
          return
        }
        if (!entry.timer) {
          updateStatus(targetKey, 'Guardado')
          savesRef.current.delete(targetKey)
        }
      })
      .catch(() => {
        entry.saving = false
        if (entry.pending && !entry.timer) {
          savePending(targetKey, entry)
          return
        }
        if (!entry.pending) {
          updateStatus(targetKey, 'Error al guardar')
          savesRef.current.delete(targetKey)
        }
      })
      .finally(() => {
        if (entry.inFlight === operation) entry.inFlight = null
      })
    entry.inFlight = operation
  }

  const update = (nextData) => {
    const current = recordRef.current
    const targetKey = resourceKey(mesaId, playerId)
    if (editLocksRef.current.has(targetKey)) return
    const authorized = permissionRef.current?.(mesaId, playerId) === true
    if (!canEditSheet(current, mesaId, playerId, authorized)) return

    const next = { ...current, data: nextData, status: 'Guardando…' }
    recordRef.current = next
    setRecord(next)
    let entry = savesRef.current.get(targetKey)
    if (!entry) {
      entry = { mesaId, playerId, timer: null, pending: null, saving: false, inFlight: null }
      savesRef.current.set(targetKey, entry)
    }
    entry.pending = { data: nextData }
    if (entry.timer) window.clearTimeout(entry.timer)
    entry.timer = window.setTimeout(() => {
      entry.timer = null
      savePending(targetKey, entry)
    }, 700)
  }

  const retrySave = () => {
    const current = recordRef.current
    const targetKey = resourceKey(mesaId, playerId)
    if (editLocksRef.current.has(targetKey)) return
    const authorized = permissionRef.current?.(mesaId, playerId) === true
    if (canEditSheet(current, mesaId, playerId, authorized) && current.status === 'Error al guardar') {
      update(current.data)
    }
  }

  const cancelPending = async (targetMesaId, targetPlayerId) => {
    const targetKey = resourceKey(targetMesaId, targetPlayerId)
    const entry = savesRef.current.get(targetKey)
    if (!entry) return
    await cancelPendingSheetSave(entry, (timer) => window.clearTimeout(timer))
    if (savesRef.current.get(targetKey) === entry && !entry.saving) {
      savesRef.current.delete(targetKey)
    }
  }

  const lockEdits = (targetMesaId, targetPlayerId, locked) => {
    const targetKey = resourceKey(targetMesaId, targetPlayerId)
    if (locked) editLocksRef.current.add(targetKey)
    else editLocksRef.current.delete(targetKey)
  }

  const flushPending = async (targetMesaId, targetPlayerId) => {
    const targetKey = resourceKey(targetMesaId, targetPlayerId)
    if (permissionRef.current?.(targetMesaId, targetPlayerId) !== true) return false
    const current = recordRef.current
    let entry = savesRef.current.get(targetKey)

    if (!entry && sheetMatches(current, targetMesaId, targetPlayerId) && current.status === 'Error al guardar') {
      entry = { mesaId: targetMesaId, playerId: targetPlayerId, timer: null, pending: { data: current.data }, saving: false, inFlight: null }
      savesRef.current.set(targetKey, entry)
      updateStatus(targetKey, 'Guardando…')
    }
    if (!entry) return current.status !== 'Guardado cancelado'

    if (entry.timer) window.clearTimeout(entry.timer)
    entry.timer = null
    if (entry.pending && !entry.saving) savePending(targetKey, entry)
    while (entry.saving || entry.pending || entry.timer) {
      if (entry.timer) {
        window.clearTimeout(entry.timer)
        entry.timer = null
      }
      if (!entry.saving && entry.pending) savePending(targetKey, entry)
      if (entry.inFlight) await entry.inFlight
    }

    const latest = recordRef.current
    return sheetMatches(latest, targetMesaId, targetPlayerId)
      && latest.status !== 'Error al guardar'
      && latest.status !== 'Guardado cancelado'
  }

  const currentRecord = sheetMatches(record, mesaId, playerId) ? record : null
  return {
    data: currentRecord?.data || defaultSheet(),
    status: currentRecord?.status || (hasResource ? 'Cargando ficha…' : ''),
    ready: Boolean(currentRecord?.ready),
    error: currentRecord?.error || '',
    update,
    retrySave,
    cancelPending,
    flushPending,
    lockEdits,
    retryLoad: () => setRetry((value) => value + 1),
  }
}
