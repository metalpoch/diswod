import { useCallback, useEffect, useRef, useState } from 'react'
import {
  buildSceneConditionUpdate,
  SCENE_CONDITION_KEYS,
  normalizeMusicSetting,
  normalizeTrackList,
  sameSceneContext,
  sceneControlAccessMessage,
  sceneControlErrorDetails,
} from '../lib/scene'
import { supabase } from '../lib/supabase'

const DEFAULT_MUSIC = { mode: 'auto', trackId: null, stale: false }

export function useScene(mesaId, oauthAccessToken, identityId = '', identitySource = '', embedded = false) {
  const [tracks, setTracks] = useState([])
  const [musicRow, setMusicRow] = useState(null)
  const [conditions, setConditions] = useState([])
  const [readyMesaId, setReadyMesaId] = useState('')
  const [error, setError] = useState('')
  const [errorMesaId, setErrorMesaId] = useState('')
  const [controlError, setControlError] = useState('')
  const [controlRetryable, setControlRetryable] = useState(false)
  const [revision, setRevision] = useState(0)
  const [retryRevision, setRetryRevision] = useState(0)
  const retryControlRef = useRef(null)
  const contextRef = useRef(null)
  const abortersRef = useRef(new Set())
  const generationRef = useRef(0)
  const contextSignature = `${mesaId || ''}|${identityId || ''}|${oauthAccessToken || ''}|${identitySource || ''}|${Boolean(embedded)}`
  if (!contextRef.current || contextRef.current.signature !== contextSignature) {
    generationRef.current += 1
    contextRef.current = {
      signature: contextSignature,
      mesaId: mesaId || '',
      identityId: identityId || '',
      token: oauthAccessToken || '',
      identitySource: identitySource || '',
      embedded: Boolean(embedded),
      generation: generationRef.current,
    }
  }
  const renderContext = contextRef.current

  useEffect(() => {
    setControlError('')
    setControlRetryable(false)
    retryControlRef.current = null
  }, [contextSignature])

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
          supabase.from('mesa_player_conditions').select('mesa_id,player_id,key,active,updated_by,updated_at').eq('mesa_id', mesaId).in('key', SCENE_CONDITION_KEYS),
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
        setConditions([])
        setReadyMesaId('')
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
    setControlError('')
    setControlRetryable(false)
    retryControlRef.current = null
    const fail = (details) => {
      setControlError(details.message)
      setControlRetryable(details.retryable)
      if (details.retryable) retryControlRef.current = () => callControl(body)
      throw new Error(details.message)
    }
    if (!captured?.mesaId) {
      fail({ message: 'Selecciona una mesa guardada para controlar la Escena.', retryable: false })
    }
    const isCurrent = () => sameSceneContext(captured, contextRef.current)
    if (!isCurrent()) return false
    const accessMessage = sceneControlAccessMessage({
      identitySource: captured.identitySource,
      embedded: captured.embedded,
      token: captured.token,
    })
    if (accessMessage) {
      fail({ message: accessMessage, retryable: false })
    }
    if (!supabase) {
      fail(sceneControlErrorDetails({
        identitySource: captured.identitySource,
        embedded: captured.embedded,
        token: captured.token,
        errorCode: 'service_unavailable',
      }))
    }
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
      const networkError = ['TypeError', 'NetworkError'].includes(requestError?.name)
      fail(sceneControlErrorDetails({
        identitySource: captured.identitySource,
        embedded: captured.embedded,
        token: captured.token,
        errorCode: networkError ? 'network_error' : 'function_error',
        networkError,
      }))
    } finally {
      abortersRef.current.delete(controller)
    }
    if (!isCurrent()) return false
    let errorCode = data?.error || ''
    if (invokeError && !errorCode) {
      try {
        const response = invokeError.context?.clone?.()
        const payload = response ? await response.json() : null
        errorCode = payload?.error || ''
      } catch {
        // Classify by HTTP status or known network errors when the body is unavailable.
      }
    }
    if (!isCurrent()) return false
    if (invokeError || errorCode) {
      const details = sceneControlErrorDetails({
        identitySource: captured.identitySource,
        embedded: captured.embedded,
        token: captured.token,
        errorCode,
        status: invokeError?.context?.status,
        networkError: ['FunctionsFetchError', 'TypeError'].includes(invokeError?.name || invokeError?.constructor?.name),
      })
      fail(details)
    }
    setControlError('')
    setControlRetryable(false)
    setRevision((value) => value + 1)
    return true
  }, [renderContext])

  const setMusic = useCallback((mode, trackId = null) => callControl({ action: 'music', mode, track_id: trackId }), [callControl])
  const setCondition = useCallback((playerId, key, active) => callControl({
    action: 'condition',
    ...buildSceneConditionUpdate(mesaId, playerId, key, active),
  }), [callControl, mesaId])
  const setFrenzy = useCallback((playerId, active) => setCondition(playerId, 'frenzy', active), [setCondition])

  const current = readyMesaId === mesaId
  const retry = useCallback(() => setRetryRevision((value) => value + 1), [])
  const retryControl = useCallback(() => {
    if (retryControlRef.current) retryControlRef.current().catch(() => {})
  }, [])
  const controlAccessMessage = sceneControlAccessMessage({
    identitySource: renderContext.identitySource,
    embedded: renderContext.embedded,
    token: renderContext.token,
  })
  return {
    mesaId,
    tracks,
    music: current ? normalizeMusicSetting(musicRow, tracks) : mesaId
      ? { mode: 'unknown', trackId: null, stale: false }
      : DEFAULT_MUSIC,
    conditions: current ? conditions : [],
    ready: current,
    error: error && (current || errorMesaId === mesaId) ? error : '',
    controlError,
    controlRetryable,
    controlAccessMessage,
    canControl: !controlAccessMessage,
    setMusic,
    setCondition,
    setFrenzy,
    retry,
    retryControl,
  }
}
