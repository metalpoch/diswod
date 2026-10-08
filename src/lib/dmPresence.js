export const DM_PRESENCE_UNKNOWN_MESSAGE = 'La presencia del Narrador no es verificable; las tiradas siguen disponibles mientras no haya una ausencia confirmada.'
export const DM_PRESENCE_UNLINKED_MESSAGE = 'El Narrador aún no vinculó su cuenta de Discord; no podemos verificar su presencia. Pídele reclamar la fila Narrador.'
export const DM_PRESENCE_MAX_PARTICIPANTS = 64

export function createDmPresenceRequestGuard(context, getCurrentContext) {
  return () => {
    const current = typeof getCurrentContext === 'function' ? getCurrentContext() : null
    return dmPresenceContextsMatch(context, current)
  }
}

export function dmPresenceContextsMatch(context, current) {
  return Boolean(
    context
    && current
    && context.mesaId === current.mesaId
    && context.playerId === current.playerId
    && context.participantKey === current.participantKey
    && context.oauthAccessToken === current.oauthAccessToken
    && context.generation === current.generation,
  )
}

export function dmPresenceContext({ mesaId, playerId, participants, generation, oauthAccessToken }) {
  return {
    mesaId: mesaId || '',
    playerId: playerId || '',
    // Kept only in this in-memory request context to invalidate token-stale responses.
    oauthAccessToken: oauthAccessToken || '',
    participantKey: dmPresenceRosterKey(participants),
    generation,
  }
}

export function dmPresenceRosterKey(participants) {
  const roster = Array.isArray(participants) ? participants : []
  if (roster.length > DM_PRESENCE_MAX_PARTICIPANTS) return `overflow:${roster.length}`
  const ids = roster.map((participant) => {
    const id = participant?.id
    return typeof id === 'string' && id.length <= 20 && /^\d{17,20}$/.test(id) ? id : null
  })
  ids.sort((left, right) => String(left).localeCompare(String(right)))
  return JSON.stringify(ids)
}

export function dmPresencePositiveSignal({ dmId, playerId, participants, remotes }) {
  if (!dmId) return false
  if (playerId === dmId) return true
  const participantList = Array.isArray(participants) ? participants : []
  const remoteList = Array.isArray(remotes) ? remotes : []
  return participantList.some((participant) => participant?.id === dmId)
    || remoteList.some((remote) => remote?.id === dmId)
}

export function dmPresenceNotice({ status, mesaPersisted, hasRoster, isDm, positiveSignal }) {
  if (!mesaPersisted || isDm || positiveSignal || !hasRoster) return ''
  if (status === 'unlinked') return DM_PRESENCE_UNLINKED_MESSAGE
  if (status === 'unknown') return DM_PRESENCE_UNKNOWN_MESSAGE
  return ''
}

export function createDmPresencePoller({ request, isCurrent, onResult, timeoutMs = 5000 }) {
  let sequence = 0
  let active = null
  let cancelled = false

  const validStatus = (status) => ['online', 'offline', 'unlinked', 'unknown'].includes(status)
  const finish = (entry, status) => {
    clearTimeout(entry.timer)
    if (cancelled || entry.timedOut || active?.id !== entry.id || !isCurrent()) return
    active = null
    onResult(validStatus(status) ? status : 'unknown')
  }

  return {
    poll(...args) {
      if (cancelled || active) return false
      const entry = { id: ++sequence, timer: null, timedOut: false }
      active = entry
      entry.timer = setTimeout(() => {
        entry.timedOut = true
        if (active?.id !== entry.id) return
        active = null
        if (!cancelled && isCurrent()) onResult('unknown')
      }, timeoutMs)
      Promise.resolve()
        .then(() => request(...args))
        .then((status) => finish(entry, status))
        .catch(() => finish(entry, 'unknown'))
      return true
    },
    cancel() {
      cancelled = true
      sequence += 1
      if (active) clearTimeout(active.timer)
      active = null
    },
  }
}
