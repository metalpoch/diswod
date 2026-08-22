import { useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'diswod.music.muted'
const DEFAULT_VOLUME = 0.06

export function useMusic(hasOthers) {
  const [ready, setReady] = useState(false)
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
  })
  const audioRef = useRef(null)
  const tracksRef = useRef([])
  const indexRef = useRef(0)
  const mutedRef = useRef(muted)
  const activeRef = useRef(Boolean(hasOthers))
  const baseVolumeRef = useRef(DEFAULT_VOLUME)
  const fadeRef = useRef(null)

  const stopFade = () => {
    if (fadeRef.current) {
      clearInterval(fadeRef.current)
      fadeRef.current = null
    }
  }

  const resumeMusic = () => {
    stopFade()
    const audio = audioRef.current
    if (!audio) return
    audio.volume = baseVolumeRef.current
    if (audio.paused) audio.play().catch(() => {})
  }

  const pauseMusic = () => {
    stopFade()
    const audio = audioRef.current
    if (!audio || audio.paused) return
    const startVol = audio.volume
    const start = performance.now()
    const dur = 500
    fadeRef.current = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / dur)
      audio.volume = Math.max(0, startVol * (1 - t))
      if (t >= 1) {
        clearInterval(fadeRef.current)
        fadeRef.current = null
        audio.pause()
      }
    }, 40)
  }

  useEffect(() => {
    mutedRef.current = muted
    if (audioRef.current) audioRef.current.muted = muted
    try { localStorage.setItem(STORAGE_KEY, muted ? '1' : '0') } catch { /* ignore */ }
  }, [muted])

  useEffect(() => {
    activeRef.current = Boolean(hasOthers)
    if (hasOthers) resumeMusic()
    else pauseMusic()
  }, [hasOthers])

  useEffect(() => {
    let cancelled = false

    const playNext = () => {
      if (!activeRef.current) return
      const audio = audioRef.current
      const tracks = tracksRef.current
      if (!audio || !tracks.length) return
      indexRef.current = (indexRef.current + 1) % tracks.length
      audio.src = `/audio/${encodeURI(tracks[indexRef.current])}`
      audio.play().catch(() => {})
    }

    const onError = () => {
      if (cancelled || !activeRef.current) return
      window.setTimeout(playNext, 1500)
    }

    const onGesture = () => {
      if (activeRef.current) resumeMusic()
    }

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
      baseVolumeRef.current = volume
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
      if (activeRef.current) audio.play().catch(() => { /* autoplay bloqueado; se reanuda al interactuar */ })
    }

    window.addEventListener('pointerdown', onGesture)
    window.addEventListener('keydown', onGesture)
    boot()

    return () => {
      cancelled = true
      stopFade()
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
    if (activeRef.current) resumeMusic()
  }

  return { ready, muted, toggleMuted }
}
