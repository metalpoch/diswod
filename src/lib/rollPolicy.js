export function shouldWaitForDm({ mesaPersisted, dmId, playerId, participants, remotes }) {
  const participantList = Array.isArray(participants) ? participants : []
  const remoteList = Array.isArray(remotes) ? remotes : []
  return Boolean(mesaPersisted)
    && Boolean(dmId)
    && playerId !== dmId
    && participantList.length > 0
    && !participantList.some((participant) => participant?.id === dmId)
    && !remoteList.some((remote) => remote?.id === dmId)
}

export function rollBlockReason({ muted, waitingForDm }) {
  if (muted && waitingForDm) return 'Estás silenciado y el Narrador no está en la mesa.'
  if (muted) return 'El Narrador te ha silenciado.'
  if (waitingForDm) return 'El Narrador no está en la mesa; las tiradas están deshabilitadas.'
  return ''
}

export function runRollIfAllowed({ muted, waitingForDm, onBlocked, onAllowed }) {
  const reason = rollBlockReason({ muted, waitingForDm })
  if (reason) {
    onBlocked?.(reason)
    return false
  }
  return onAllowed?.() ?? true
}

export async function submitRoll({ onRoll, parsed, onClear }) {
  const result = await onRoll(parsed)
  if (result === false) return false
  onClear()
  return true
}
