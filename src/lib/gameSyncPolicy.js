function isLocalIdentity(identity) {
  return identity?.source === 'local' && String(identity.id || '').startsWith('local-')
}

export function canUseGameSync({ status, embedded }, identity) {
  if (!identity?.id) return false
  if (embedded && status === 'discord') {
    return identity.source === 'discord-auth' || identity.source === 'participant'
  }
  if (!embedded && status === 'standalone') return isLocalIdentity(identity)
  return false
}
