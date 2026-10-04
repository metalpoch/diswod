import { useCallback, useEffect, useRef, useState } from 'react'
import { canAutoplayMusic, clearMusicTimer, musicErrorTransition } from '../lib/scene'
import { supabase, proxiedUrl } from '../lib/supabase'

const STORAGE_KEY = 'diswod.music.muted'
const DEFAULT_VOLUME = 0.12

function getTrackId(track) {
  return typeof track === 'string' ? track : String(track?.id || '')
}

function getTrackUrl(track) {
  if (!supabase) return ''
  const { data } = supabase.storage.from('audio').getPublicUrl(getTrackId(track))
  return proxiedUrl(data?.publicUrl || '')
}

export function useMusic(selection = null, { persisted = false, sceneReady = true, contextKey = '' } = {}) {
  const [ready, setReady] = useState(false)
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
  })
  const [playback, setPlayback] = useState({ error: false, fallback: false })
  const [retryKey, setRetryKey] = useState(0)
  const audioRef = useRef(null)
  const tracksRef = useRef([])
  const indexRef = useRef(0)
  const mutedRef = useRef(muted)
  const selectionRef = useRef(selection)
  const optionsRef = useRef({ persisted, sceneReady, contextKey })
  const contextKeyRef = useRef(contextKey)
  const activeSelectionKeyRef = useRef('')
  const activeUrlRef = useRef('')
  const fallbackKeyRef = useRef('')
  const timerRef = useRef(null)
  const stoppedRef = useRef(false)

  selectionRef.current = selection
  optionsRef.current = { persisted, sceneReady, contextKey }
  contextKeyRef.current = contextKey

  const canPlay = () => canAutoplayMusic({
    persisted: optionsRef.current.persisted,
    ready: optionsRef.current.sceneReady,
    mode: selectionRef.current?.mode,
  })

  const ensurePlaying = useCallback(() => {
    const audio = audioRef.current
    if (audio && canPlay() && !stoppedRef.current && tracksRef.current.length && audio.paused) audio.play().catch(() => {})
  }, [])

  useEffect(() => {
    mutedRef.current = muted
    if (audioRef.current) audioRef.current.muted = muted
    try { localStorage.setItem(STORAGE_KEY, muted ? '1' : '0') } catch { /* ignore */ }
  }, [muted])

  useEffect(() => {
    let cancelled = false
    const onGesture = () => ensurePlaying()

    async function boot() {
      let tracks = []
      let volume = DEFAULT_VOLUME
      try {
        const response = await fetch('/audio/manifest.json')
        if (response.ok) {
          const data = await response.json()
          tracks = Array.isArray(data) ? data : (data?.tracks || [])
          if (typeof data?.volume === 'number') volume = Math.max(0, Math.min(1, data.volume))
        }
      } catch { /* no audio */ }
      if (cancelled || !tracks.length) return
      tracksRef.current = tracks
      const audio = new Audio()
      audio.volume = volume
      audio.muted = mutedRef.current
      audio.preload = 'auto'
      audioRef.current = audio
      setReady(true)
      window.dispatchEvent(new Event('diswod-music-ready'))
    }

    window.addEventListener('pointerdown', onGesture)
    window.addEventListener('keydown', onGesture)
    boot()
    return () => {
      cancelled = true
      clearMusicTimer(timerRef)
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
      const audio = audioRef.current
      if (audio) {
        audio.pause()
        audio.removeAttribute('src')
        audioRef.current = null
      }
      tracksRef.current = []
    }
  }, [ensurePlaying])

  useEffect(() => {
    clearMusicTimer(timerRef)
    const audio = audioRef.current
    if (!audio || !ready) return
    if (persisted && !sceneReady) {
      audio.pause()
      activeSelectionKeyRef.current = ''
      fallbackKeyRef.current = ''
      stoppedRef.current = false
      setPlayback({ error: false, fallback: false })
      return
    }

    const configuredMode = selection?.mode || 'auto'
    const requestedTrack = configuredMode === 'track'
      ? tracksRef.current.find((track) => getTrackId(track) === selection.trackId)
      : null
    const chosenTrackMode = configuredMode === 'track' && Boolean(requestedTrack)
    const baseKey = `${contextKey}:${configuredMode}:${selection?.trackId || ''}`
    const selectionKey = `${baseKey}:${retryKey}`

    if (activeSelectionKeyRef.current && activeSelectionKeyRef.current !== baseKey) {
      audio.pause()
      activeSelectionKeyRef.current = ''
      fallbackKeyRef.current = ''
      stoppedRef.current = false
      activeUrlRef.current = ''
      setPlayback({ error: false, fallback: false })
    }
    if (configuredMode === 'off') {
      audio.pause()
      activeSelectionKeyRef.current = selectionKey
      activeUrlRef.current = ''
      fallbackKeyRef.current = ''
      stoppedRef.current = false
      setPlayback({ error: false, fallback: false })
      return
    }
    if (activeSelectionKeyRef.current === baseKey) return
    const fallbackUsed = fallbackKeyRef.current === baseKey
    const track = chosenTrackMode && !fallbackUsed ? requestedTrack : tracksRef.current[0]
    if (!track) return
    const mode = chosenTrackMode && !fallbackUsed ? 'track' : 'auto'
    const playNext = () => {
      const localAutoFallback = fallbackKeyRef.current && fallbackKeyRef.current === activeSelectionKeyRef.current
      if (!canPlay() || (selectionRef.current?.mode !== 'auto' && !localAutoFallback)) return
      const tracks = tracksRef.current
      if (!tracks.length) return
      indexRef.current = (indexRef.current + 1) % tracks.length
      const nextUrl = getTrackUrl(tracks[indexRef.current])
      if (!nextUrl) return
      activeUrlRef.current = nextUrl
      audio.src = nextUrl
      audio.play().catch(() => {})
    }
    const onError = () => {
      if (!canPlay() || !activeSelectionKeyRef.current
        || (audio.currentSrc && activeUrlRef.current && audio.currentSrc !== activeUrlRef.current)) return
      const isChosenTrack = selectionRef.current?.mode === 'track'
      const transition = musicErrorTransition({
        mode: isChosenTrack ? 'track' : 'auto',
        fallbackUsed: fallbackKeyRef.current === activeSelectionKeyRef.current,
      })
      audio.pause()
      if (transition.fallbackUsed && !transition.stopped) {
        fallbackKeyRef.current = activeSelectionKeyRef.current
        activeSelectionKeyRef.current = ''
        stoppedRef.current = false
        setPlayback({ error: true, fallback: true })
        setRetryKey((value) => value + 1)
      } else {
        stoppedRef.current = true
        setPlayback({ error: true, fallback: fallbackKeyRef.current === activeSelectionKeyRef.current })
      }
    }
    audio.addEventListener('ended', playNext)
    audio.addEventListener('error', onError)
    activeSelectionKeyRef.current = baseKey
    indexRef.current = Math.max(0, tracksRef.current.indexOf(track))
    const url = getTrackUrl(track)
    if (!url) {
      audio.removeEventListener('ended', playNext)
      audio.removeEventListener('error', onError)
      return
    }
    activeUrlRef.current = url
    audio.src = url
    audio.play().catch(() => { /* browser gesture listener retries autoplay blocks */ })
    if (mode === 'auto' && fallbackUsed) setPlayback({ error: true, fallback: true })
    return () => {
      audio.removeEventListener('ended', playNext)
      audio.removeEventListener('error', onError)
    }
  }, [ready, persisted, sceneReady, contextKey, selection?.mode, selection?.trackId, retryKey])

  const toggleMuted = useCallback(() => {
    setMuted((value) => !value)
    ensurePlaying()
  }, [ensurePlaying])
  const retryMusic = useCallback(() => {
    if (contextKeyRef.current !== contextKey) return
    stoppedRef.current = false
    setPlayback({ error: false, fallback: fallbackKeyRef.current !== '' })
    activeSelectionKeyRef.current = ''
    setRetryKey((value) => value + 1)
  }, [contextKey])
  const useAutomatic = useCallback(() => {
    if (contextKeyRef.current !== contextKey) return
    stoppedRef.current = false
    fallbackKeyRef.current = `${contextKey}:${selection?.mode}:${selection?.trackId || ''}`
    activeSelectionKeyRef.current = ''
    setPlayback({ error: false, fallback: true })
    setRetryKey((value) => value + 1)
  }, [contextKey, selection?.mode, selection?.trackId])

  return { ready, muted, toggleMuted, playbackError: playback.error, localFallback: playback.fallback, retryMusic, useAutomatic }
}
