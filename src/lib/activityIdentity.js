export function authenticatedIdentity(user) {
  if (!user?.id || String(user.id).startsWith('local-')) return null
  const { accessToken: _accessToken, ...profile } = user
  return { ...profile, id: user.id, discordId: user.id, source: 'discord-auth' }
}

export function identityForBoot(savedIdentity, { activity, user } = {}) {
  const verified = authenticatedIdentity(user)
  if (verified) return verified
  if (activity) return null
  if (savedIdentity?.source === 'local' && String(savedIdentity.id || '').startsWith('local-')) {
    return savedIdentity
  }
  return null
}

export function identityForMesaAccess(identity, status) {
  return status === 'boot' || status === 'activity-error' ? null : identity
}

export function activityStartupPolicy({ sdkAvailable, user, roster = [], rosterSettled = false }) {
  const identity = authenticatedIdentity(user)
  if (!sdkAvailable) return { status: 'activity-error', identity: null, fallbackReady: false }
  if (identity) return { status: 'discord', identity, fallbackReady: false }
  if (!rosterSettled) return { status: 'discord', identity: null, fallbackReady: false }
  if (Array.isArray(roster) && roster.length > 0) {
    return { status: 'discord', identity: null, fallbackReady: true }
  }
  return { status: 'activity-error', identity: null, fallbackReady: false }
}

export function participantFallbackIdentity(participant, roster) {
  if (!participant?.id || String(participant.id).startsWith('local-') || !Array.isArray(roster)) return null
  const selected = roster.find((person) => person?.id === participant.id)
  return selected ? { ...selected, source: 'participant' } : null
}

export function participantFallbackRemoved(participantId, roster, source) {
  return Boolean(
    participantId
    && source === 'event'
    && (!Array.isArray(roster) || !roster.some((person) => person?.id === participantId)),
  )
}

export function establishAuthenticatedIdentity(user, setIdentity, persistIdentity) {
  const identity = identityForBoot(null, { activity: true, user })
  setIdentity(identity)
  if (identity) {
    try {
      persistIdentity(identity)
    } catch {
      /* Persistence failure must not invalidate a verified in-memory identity. */
    }
  }
  return identity
}

export function localIdentity(name, makeId) {
  return {
    id: `local-${makeId()}`,
    name: name || 'Jugador',
    avatar: null,
    source: 'local',
  }
}

export async function readParticipantsResult(read, sdk, timeoutMs = 5000) {
  let timer
  try {
    const result = await Promise.race([
      Promise.resolve().then(() => read(sdk)).then((value) => ({
        ok: Array.isArray(value),
        participants: Array.isArray(value) ? value : [],
      })),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve({ ok: false, participants: [] }), timeoutMs)
      }),
    ])
    return result
  } catch {
    return { ok: false, participants: [] }
  } finally {
    clearTimeout(timer)
  }
}

export async function readParticipantsSafely(read, sdk, timeoutMs = 5000) {
  return (await readParticipantsResult(read, sdk, timeoutMs)).participants
}

export function startParticipantSync({
  sdk,
  subscribe,
  read,
  onParticipants,
  onRoster,
  onSubscription,
  timeoutMs = 5000,
}) {
  let cancelled = false
  let registrationExpired = false
  let subscriptionConfirmed = false
  let readinessSettled = false
  let eventGeneration = 0
  let unsubscribe = null
  let unsubscribeCalled = false
  const initialGeneration = eventGeneration
  let registrationTimer
  let resolveSubscriptionReady

  const subscriptionReady = new Promise((resolve) => {
    resolveSubscriptionReady = resolve
  })

  const publish = (people, source, ok) => {
    if (cancelled) return
    try {
      onParticipants(Array.isArray(people) ? people : [])
    } catch {
      /* A participant callback is auxiliary and cannot affect Activity startup. */
    }
    try {
      onRoster?.({ source, ok, participants: Array.isArray(people) ? people : [] })
    } catch {
      /* Roster availability is auxiliary and cannot affect Activity startup. */
    }
  }

  const disposeSubscription = () => {
    if (!unsubscribe || unsubscribeCalled) return
    unsubscribeCalled = true
    try {
      Promise.resolve(unsubscribe()).catch(() => {})
    } catch {
      /* Ignore synchronous and asynchronous SDK cleanup failures. */
    }
  }

  const finishRegistration = (ready, notify = true) => {
    if (readinessSettled) return
    readinessSettled = true
    subscriptionConfirmed = ready
    registrationExpired = !ready
    clearTimeout(registrationTimer)
    if (notify) {
      try {
        onSubscription?.(ready)
      } catch {
        /* Subscription diagnostics cannot affect identity or sync lifecycle. */
      }
    }
    resolveSubscriptionReady(ready)
  }

  registrationTimer = setTimeout(() => finishRegistration(false), timeoutMs)

  const registered = Promise.resolve()
    .then(() => {
      if (cancelled || registrationExpired) return null
      return subscribe(sdk, (people) => {
        if (cancelled || registrationExpired || !subscriptionConfirmed) return
        eventGeneration += 1
        publish(people, 'event', true)
      })
    })
    .then((cleanup) => {
      if (cancelled || registrationExpired) {
        if (typeof cleanup === 'function') {
          try {
            Promise.resolve(cleanup()).catch(() => {})
          } catch {
            /* Late subscription cleanup is best effort. */
          }
        }
        return
      }
      unsubscribe = typeof cleanup === 'function' ? cleanup : null
      finishRegistration(true)
    })
    .catch(() => {
      finishRegistration(false, !cancelled)
    })

  const initialRead = subscriptionReady
    .then((ready) => {
      if (cancelled || !ready) return null
      return readParticipantsResult(read, sdk, timeoutMs)
    })
    .then((result) => {
      if (result && !cancelled && eventGeneration === initialGeneration) {
        publish(result.participants, 'read', result.ok)
      }
    })
    .catch(() => {})

  return {
    registered,
    subscriptionReady,
    initialRead,
    cancel() {
      cancelled = true
      finishRegistration(false, false)
      disposeSubscription()
    },
  }
}

export function standaloneIdentityOrNull(identity, clearPersistedIdentity) {
  const retained = identityForBoot(identity, { activity: false })
  if (retained) return retained
  try {
    clearPersistedIdentity()
  } catch {
    /* Keep startup independent from storage availability. */
  }
  return null
}

export function identityPresentation(identity, mode) {
  if (mode === 'discord' && identity?.source === 'discord-auth') {
    return {
      label: 'Discord autenticado',
      detail: 'Identidad verificada por Discord en esta sesión.',
      kind: 'verified',
    }
  }
  if (identity?.source === 'participant' || identity?.source === 'discord') {
    return {
      label: 'Participante seleccionado · no autenticado',
      detail: 'Identidad elegida de la lista de participantes; no es autenticación OAuth.',
      kind: 'selected',
    }
  }
  if (identity?.source === 'discord-auth') {
    return {
      label: 'Identidad guardada · no verificada en esta sesión',
      detail: 'Esta sesión no ha confirmado la autenticación de Discord.',
      kind: 'unverified',
    }
  }
  if (mode === 'discord' && !identity) {
    return {
      label: 'Autenticación Discord no disponible · selección requerida',
      detail: 'Elige un participante de la Activity; la selección no autentica tu cuenta.',
      kind: 'unverified',
    }
  }
  return {
    label: 'Invitado local · solo este navegador/dispositivo',
    detail: 'La identidad local no se comparte entre dispositivos.',
    kind: 'local',
  }
}

export function normalizeIdentitySelection(next, current) {
  if (!next) return next
  if (next.source === 'discord-auth' && current?.source === 'discord-auth' && next.id === current.id) {
    return next
  }
  if (next.source === 'discord-auth') {
    return { ...next, source: String(next.id || '').startsWith('local-') ? 'local' : 'participant' }
  }
  if (next.source === 'discord') return { ...next, source: 'participant' }
  return next
}
