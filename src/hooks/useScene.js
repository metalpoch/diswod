import { useCallback, useEffect, useRef, useState } from 'react'
import { buildFrenzyUpdate, normalizeMusicSetting, normalizeTrackList, sameSceneContext } from '../lib/scene'
import { supabase } from '../lib/supabase'

const DEFAULT_MUSIC = { mode: 'auto', trackId: null, stale: false }

export function useScene(mesaId, oauthAccessToken, isDm, identityId = '') {
  const [tracks, setTracks] = useState([])
  const [musicRow, setMusicRow] = useState(null)
  const [conditions, setConditions] = useState([])
  const [readyMesaId, setReadyMesaId] = useState('')
  const [error, setError] = useState('')
  const [errorMesaId, setErrorMesaId] = useState('')
  const [revision, setRevision] = useState(0)
  const [retryRevision, setRetryRevision] = useState(0)
  const contextRef = useRef(null)
  const abortersRef = useRef(new Set())
  const generationRef = useRef(0)
  const contextSignature = `${mesaId || ''}|${identityId || ''}|${oauthAccessToken || ''}|${Boolean(isDm)}`
  if (!contextRef.current || contextRef.current.signature !== contextSignature) {
    generationRef.current += 1
    contextRef.current = {
      signature: contextSignature,
      mesaId: mesaId || '',
      identityId: identityId || '',
      token: oauthAccessToken || '',
      isDm: Boolean(isDm),
      generation: generationRef.current,
    }
  }
  const renderContext = contextRef.current

  useEffect(() => {
    for (const controller of abortersRef.current) controller.abort()
    abortersRef.current.clear()
  }, [contextSignature])

  useEffect(() => () => {
    for (const controller of abortersRef.current) controller.abort()
    abortersRef.current.clear()
  }, [])

  useEffect(() => {
    let active = true
    fetch('/audio/manifest.json')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('manifest'))))
      .then((manifest) => {
        if (active) setTracks(normalizeTrackList(Array.isArray(manifest) ? manifest : manifest?.tracks))
      })
      .catch(() => { if (active) setTracks([]) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!mesaId || !supabase) {
      setMusicRow(null)
      setConditions([])
      setReadyMesaId('')
      setError('')
      setErrorMesaId('')
      return undefined
    }
    let active = true
    setMusicRow(null)
    setConditions([])
    setReadyMesaId('')
    setError('')
    setErrorMesaId('')
    const refresh = async () => {
      try {
        const [settingsResult, conditionsResult] = await Promise.all([
          supabase.from('mesa_scene_settings').select('music_mode,track_id,updated_by,updated_at').eq('mesa_id', mesaId).maybeSingle(),
          supabase.from('mesa_player_conditions').select('mesa_id,player_id,key,active,updated_by,updated_at').eq('mesa_id', mesaId).eq('key', 'frenzy'),
        ])
        if (settingsResult.error) throw settingsResult.error
        if (conditionsResult.error) throw conditionsResult.error
        if (!active) return
        setMusicRow(settingsResult.data || null)
        setConditions(conditionsResult.data || [])
        setReadyMesaId(mesaId)
        setError('')
        setErrorMesaId('')
      } catch {
        if (!active) return
        setErrorMesaId(mesaId)
        setError('No se pudo cargar el estado de escena. Comprueba que esté aplicada la migración y las policies de lectura.')
      }
    }
    refresh()
    const timer = window.setInterval(refresh, 3000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [mesaId, revision, retryRevision])

  const callControl = useCallback(async (body) => {
    const captured = renderContext
    if (!captured?.mesaId || !captured.isDm || !captured.identityId || !captured.token) {
      throw new Error('Solo un Narrador verificado puede controlar la escena.')
    }
    const isCurrent = () => sameSceneContext(captured, contextRef.current)
    if (!isCurrent()) return false
    if (!supabase) throw new Error('Supabase no está disponible.')
    const controller = new AbortController()
    abortersRef.current.add(controller)
    let data
    let invokeError
    try {
      ({ data, error: invokeError } = await supabase.functions.invoke('mesa-scene-control', {
        body: { ...body, mesa_id: captured.mesaId },
        headers: { Authorization: `Bearer ${captured.token}` },
        signal: controller.signal,
      }))
    } catch (requestError) {
      if (!isCurrent()) return false
      throw requestError
    } finally {
      abortersRef.current.delete(controller)
    }
    if (!isCurrent()) return false
    if (invokeError) throw new Error(invokeError.message || 'No se pudo guardar el estado de escena.')
    if (data?.error) throw new Error(data.error === 'dm_required'
      ? 'Solo el Narrador puede cambiar la escena.'
      : 'No se pudo guardar el estado de escena.')
    setRevision((value) => value + 1)
    return true
  }, [renderContext])

  const setMusic = useCallback((mode, trackId = null) => callControl({ action: 'music', mode, track_id: trackId }), [callControl])
  const setFrenzy = useCallback((playerId, active) => callControl({
    action: 'condition',
    ...buildFrenzyUpdate(mesaId, playerId, active),
  }), [callControl, mesaId])

  const current = readyMesaId === mesaId
  const retry = useCallback(() => setRetryRevision((value) => value + 1), [])
  return {
    tracks,
    music: current ? normalizeMusicSetting(musicRow, tracks) : mesaId
      ? { mode: 'unknown', trackId: null, stale: false }
      : DEFAULT_MUSIC,
    conditions: current ? conditions : [],
    ready: current,
    error: error && (current || errorMesaId === mesaId) ? error : '',
    isDm: Boolean(isDm),
    setMusic,
    setFrenzy,
    retry,
  }
}
