import { useEffect, useState } from 'react'
import { getMesa } from '../lib/mesasApi'
import { proxiedUrl } from '../lib/supabase'

export function useMesaBackground(mesaId) {
  const [backgroundUrl, setBackgroundUrl] = useState('')

  useEffect(() => {
    if (!mesaId) {
      setBackgroundUrl('')
      return undefined
    }
    let active = true
    getMesa(mesaId)
      .then((mesa) => {
        if (active) setBackgroundUrl(proxiedUrl(mesa.backgroundUrl || ''))
      })
      .catch(() => {})
    const timer = window.setInterval(() => {
      getMesa(mesaId)
        .then((mesa) => {
          if (active) setBackgroundUrl(proxiedUrl(mesa.backgroundUrl || ''))
        })
        .catch(() => {})
    }, 3000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [mesaId])

  return backgroundUrl
}
