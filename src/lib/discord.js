const AVATAR = (id, avatar) =>
  avatar
    ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=64`
    : null

export function isLikelyEmbedded() {
  try {
    return window.parent !== window || Boolean(new URLSearchParams(window.location.search).get('frame_id'))
  } catch {
    return false
  }
}

export function roomFromLocation() {
  const params = new URLSearchParams(window.location.search)
  const fromQuery = (params.get('room') || '').trim()
  if (fromQuery) return sanitizeRoom(fromQuery)
  if (window.location.hash.length > 1) return sanitizeRoom(window.location.hash.slice(1))
  return ''
}

export function sanitizeRoom(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 48)
}

export function randomRoom() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  const buf = new Uint8Array(6)
  crypto.getRandomValues(buf)
  for (const n of buf) out += alphabet[n % alphabet.length]
  return out
}

export function persistRoom(room) {
  const url = new URL(window.location.href)
  url.searchParams.set('room', room)
  window.history.replaceState({}, '', url)
}

export function loadIdentity() {
  try {
    const raw = localStorage.getItem('diswod.identity')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveIdentity(identity) {
  localStorage.setItem('diswod.identity', JSON.stringify(identity))
}

export function colorFromName(name) {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  const hues = [0, 8, 18, 32, 350, 342]
  const hue = hues[hash % hues.length]
  return `hsl(${hue} 62% 38%)`
}

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() || '?').join('')
}

export async function connectDiscord(clientId) {
  if (!clientId || !isLikelyEmbedded()) return null
  const { DiscordSDK } = await import('@discord/embedded-app-sdk')
  const sdk = new DiscordSDK(clientId)
  await Promise.race([
    sdk.ready(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Discord SDK timeout')), 2500)
    }),
  ])
  return sdk
}

export async function readParticipants(sdk) {
  if (!sdk) return []
  const { participants } = await sdk.commands.getInstanceConnectedParticipants()
  return (participants || []).map((p) => ({
    id: p.id || p.user?.id,
    name: p.nickname || p.username || p.user?.username || 'Kindred',
    avatar: AVATAR(p.id || p.user?.id, p.avatar || p.user?.avatar),
    source: 'discord',
  }))
}

export function subscribeParticipants(sdk, onChange) {
  if (!sdk) return () => {}
  const handler = (event) => {
    const list = (event.participants || []).map((p) => ({
      id: p.id || p.user?.id,
      name: p.nickname || p.username || p.user?.username || 'Kindred',
      avatar: AVATAR(p.id || p.user?.id, p.avatar || p.user?.avatar),
      source: 'discord',
    }))
    onChange(list)
  }
  sdk.subscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', handler)
  return () => {
    try {
      sdk.unsubscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', handler)
    } catch {
      /* ignore */
    }
  }
}
