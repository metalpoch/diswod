import { useEffect, useRef, useState } from 'react'
import { defaultSheet, normalizeSheet } from '../lib/characterSheet'
import { loadSheet, saveSheet } from '../lib/mesasApi'

export function useSheet(mesaId, playerId) {
  const [data, setData] = useState(defaultSheet)
  const [status, setStatus] = useState('')
  const [ready, setReady] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    window.clearTimeout(timer.current)
    if (!mesaId || !playerId) {
      setData(defaultSheet())
      setStatus('')
      setReady(false)
      return undefined
    }
    let active = true
    setReady(false)
    setData(defaultSheet())
    loadSheet(mesaId, playerId)
      .then((row) => {
        if (!active) return
        setData(normalizeSheet(row.data))
        setReady(true)
      })
      .catch(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
      window.clearTimeout(timer.current)
    }
  }, [mesaId, playerId])

  const update = (next) => {
    setData(next)
    if (!mesaId || !playerId) return
    setStatus('Guardando…')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      saveSheet(mesaId, playerId, next)
        .then(() => setStatus('Guardado'))
        .catch(() => setStatus('Error al guardar'))
    }, 700)
  }

  return { data, status, ready, update }
}
