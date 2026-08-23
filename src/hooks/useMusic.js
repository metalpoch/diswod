import { useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'diswod.music.muted'
const DEFAULT_VOLUME = 0.15

export function useMusic() {
  const [ready, setReady] = useState(false)
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
  })
  const audioRef = useRef(null)
  const tracksRef = useRef([])
  const indexRef = useRef(0)
  const mutedRef = useRef(muted)

  const ensurePlaying = () => {
    const audio = audioRef.current
    if (audio && tracksRef.current.length && audio.paused) audio.play().catch(() => {})
  }

  useEffect(() => {
    mutedRef.current = muted
    if (audioRef.current) audioRef.current.muted = muted
    try { localStorage.setItem(STORAGE_KEY, muted ? '1' : '0') } catch { /* ignore */ }
  }, [muted])

  useEffect(() => {
    let cancelled = false

    const playNext = () => {
      const audio = audioRef.current
      const tracks = tracksRef.current
      if (!audio || !tracks.length) return
      indexRef.current = (indexRef.current + 1) % tracks.length
      audio.src = `/audio/${encodeURI(tracks[indexRef.current])}`
      audio.play().catch(() => {})
    }

    const onError = () => {
      if (cancelled) return
      window.setTimeout(playNext, 1500)
    }

    const onGesture = () => ensurePlaying()

    async function boot() {
      let tracks = []
      let volume = DEFAULT_VOLUME
      try {
        const res = await fetch('/audio/manifest.json')
        if (res.ok) {
          const data = await res.json()
          tracks = Array.isArray(data) ? data : (data?.tracks || [])
          if (typeof data?.volume === 'number') volume = data.volume
        }
      } catch { /* no audio */ }
      if (cancelled || !tracks.length) return

      tracksRef.current = tracks
      const audio = new Audio()
      audio.volume = volume
      audio.muted = mutedRef.current
      audio.preload = 'auto'
      audio.addEventListener('ended', playNext)
      audio.addEventListener('error', onError)
      audioRef.current = audio
      indexRef.current = 0
      audio.src = `/audio/${encodeURI(tracks[0])}`
      setReady(true)
      audio.play().catch(() => { /* autoplay bloqueado; se reanuda al interactuar */ })
    }

    window.addEventListener('pointerdown', onGesture)
    window.addEventListener('keydown', onGesture)
    boot()

    return () => {
      cancelled = true
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
      const audio = audioRef.current
      if (audio) {
        audio.pause()
        audio.removeEventListener('ended', playNext)
        audio.removeEventListener('error', onError)
        audioRef.current = null
      }
      tracksRef.current = []
    }
  }, [])

  const toggleMuted = () => {
    setMuted((m) => !m)
    ensurePlaying()
  }

  return { ready, muted, toggleMuted }
}
