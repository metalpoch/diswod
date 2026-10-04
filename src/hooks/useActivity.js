import { useEffect, useMemo, useRef, useState } from 'react'
import {
  connectDiscord,
  clearIdentity,
  isLikelyEmbedded,
  loadIdentity,
  persistRoom,
  randomRoom,
  readParticipants,
  roomFromLocation,
  saveIdentity,
  subscribeParticipants,
} from '../lib/discord'
import {
  activityStartupPolicy,
  establishAuthenticatedIdentity,
  identityForBoot,
  normalizeIdentitySelection,
  participantFallbackRemoved,
  standaloneIdentityOrNull,
  startParticipantSync,
} from '../lib/activityIdentity'
import { resolvePlayerIdentityLinks } from '../lib/playerIdentityLinks'

export function useActivity() {
  const [activityContext] = useState(() => isLikelyEmbedded())
  const [sdk, setSdk] = useState(null)
  const [status, setStatus] = useState('boot')
  const [participants, setParticipants] = useState([])
  const [identity, setIdentityState] = useState(() => identityForBoot(loadIdentity(), {
    activity: activityContext,
  }))
  const [oauthAccessToken, setOauthAccessToken] = useState('')
  const [identityLinksReady, setIdentityLinksReady] = useState(!activityContext)
  const [fallbackReady, setFallbackReady] = useState(false)
  const [presenceStatus, setPresenceStatus] = useState('idle')
  const [error, setError] = useState('')
  const [roomId, setRoomId] = useState(() => roomFromLocation())
  const [instanceId, setInstanceId] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const fallbackSelected = useRef(false)
  const fallbackSelectedId = useRef('')

  useEffect(() => {
    let cancelled = false
    let participantSync = null

    setStatus('boot')
    setSdk(null)
    setInstanceId('')
    setParticipants([])
    setFallbackReady(false)
    setPresenceStatus(activityContext ? 'pending' : 'idle')
    setError('')
    setOauthAccessToken('')
    setIdentityLinksReady(!activityContext)
    fallbackSelected.current = false
    fallbackSelectedId.current = ''
    if (activityContext) {
      setIdentityState(null)
      clearIdentity()
    }

    const restoreStandaloneIdentity = () => {
      const saved = loadIdentity() || identity
      const retained = standaloneIdentityOrNull(saved, clearIdentity)
      setIdentityState(retained)
    }

    const failActivityStartup = (message) => {
      const policy = activityStartupPolicy({ sdkAvailable: false })
      setIdentityState(policy.identity)
      clearIdentity()
      setFallbackReady(policy.fallbackReady)
      setError(message)
      setStatus(policy.status)
    }

    async function boot() {
      try {
        const { sdk: next, user, accessToken } = await connectDiscord()
        if (cancelled) return
        if (!next) {
          if (activityContext) {
            failActivityStartup('No se pudo iniciar Discord Activity. Reintenta o vuelve a abrir la Activity.')
            return
          }
          if (!roomFromLocation()) {
            const generated = randomRoom()
            persistRoom(generated)
            setRoomId(generated)
          }
          restoreStandaloneIdentity()
          setIdentityLinksReady(true)
          setStatus('standalone')
          return
        }
        setSdk(next)
        setInstanceId(next.instanceId || '')
        const room = next.instanceId || roomFromLocation() || randomRoom()
        persistRoom(room)
        setRoomId(room)
        const startup = activityStartupPolicy({
          sdkAvailable: true,
          user,
          rosterSettled: false,
        })
        // Fix and persist verified OAuth identity before starting participant discovery.
        const verified = establishAuthenticatedIdentity(user, setIdentityState, saveIdentity)
        if (verified && accessToken) {
          setOauthAccessToken(accessToken)
          Promise.race([
            resolvePlayerIdentityLinks(accessToken).then((links) => ({ links })),
            new Promise((resolve) => window.setTimeout(() => resolve({ links: null }), 8000)),
          ]).then(({ links }) => {
            if (cancelled) return
            if (links) setIdentityState((current) => current?.id === verified.id ? { ...current, links } : current)
          }).catch(() => {}).finally(() => {
            if (!cancelled) setIdentityLinksReady(true)
          })
        } else {
          setIdentityLinksReady(true)
        }
        if (!verified) clearIdentity()
        setStatus(startup.status)
        setFallbackReady(startup.fallbackReady)
        try {
          participantSync = startParticipantSync({
            sdk: next,
            subscribe: subscribeParticipants,
            read: readParticipants,
            onParticipants: setParticipants,
            onSubscription: (ready) => {
              setPresenceStatus(ready ? 'pending' : 'unavailable')
              if (!ready && !verified) {
                setFallbackReady(false)
                setError('No se pudo mantener la lista de participantes. Reintenta la conexión.')
                setStatus('activity-error')
              }
            },
            onRoster: (result) => {
              setPresenceStatus(result.ok ? 'available' : 'unavailable')
              if (verified) return
              if (fallbackSelected.current) {
                const selectedId = fallbackSelectedId.current
                if (!participantFallbackRemoved(selectedId, result.participants, result.source)) return
                fallbackSelected.current = false
                fallbackSelectedId.current = ''
                clearIdentity()
                setIdentityState((current) => (
                  current?.id === selectedId && current.source === 'participant' ? null : current
                ))
              }
              const policy = activityStartupPolicy({
                sdkAvailable: true,
                user: null,
                roster: result.participants,
                rosterSettled: true,
              })
              setFallbackReady(policy.fallbackReady)
              setError(policy.status === 'activity-error'
                ? 'No se pudo obtener una lista de participantes. Reintenta la conexión.'
                : '')
              setStatus(policy.status)
            },
          })
        } catch {
          setPresenceStatus('unavailable')
          if (!verified) {
            setError('No se pudo obtener una lista de participantes. Reintenta la conexión.')
            setStatus('activity-error')
          }
        }
      } catch {
        if (cancelled) return
        if (activityContext) {
          failActivityStartup('No se pudo iniciar Discord Activity. Reintenta o vuelve a abrir la Activity.')
          return
        }
        if (!roomFromLocation()) {
          const generated = randomRoom()
          persistRoom(generated)
          setRoomId(generated)
        }
        restoreStandaloneIdentity()
        setIdentityLinksReady(true)
        setStatus('standalone')
      }
    }

    boot()
    return () => {
      cancelled = true
      participantSync?.cancel()
    }
  }, [activityContext, retryCount])

  const setIdentity = (next) => {
    if (next?.source === 'participant' || next?.source === 'discord') {
      fallbackSelected.current = true
      fallbackSelectedId.current = next.id || ''
    }
    setIdentityState((current) => {
      const normalized = normalizeIdentitySelection(next, current)
      if (normalized?.source === 'participant') {
        fallbackSelected.current = true
        fallbackSelectedId.current = normalized.id || ''
      }
      saveIdentity(normalized)
      return normalized
    })
  }

  const replaceIdentityLinks = (links) => {
    if (identity?.source !== 'discord-auth') return identity
    const next = { ...identity, links }
    setIdentityState(next)
    saveIdentity(next)
    return next
  }

  const retry = () => {
    if (activityContext) {
      setIdentityState(null)
      clearIdentity()
      fallbackSelected.current = false
      fallbackSelectedId.current = ''
      setPresenceStatus('pending')
    }
    setStatus('boot')
    setError('')
    setFallbackReady(false)
    setRetryCount((current) => current + 1)
  }

  const mergePlayers = (extra = []) => {
    const map = new Map()
    for (const p of [...participants, ...extra]) {
      if (p?.id) map.set(p.id, { ...map.get(p.id), ...p })
    }
    if (identity?.id) {
      map.set(identity.id, { ...map.get(identity.id), ...identity, self: true })
    }
    return Array.from(map.values())
  }

  const players = useMemo(() => mergePlayers(), [participants, identity])

  return {
    sdk,
    status,
    players,
    mergePlayers,
    participants,
    identity,
    oauthAccessToken,
    identityLinksReady,
    setIdentity,
    replaceIdentityLinks,
    fallbackReady,
    presenceStatus,
    error,
    retry,
    roomId,
    instanceId,
    embedded: activityContext,
  }
}
