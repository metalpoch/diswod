import { supabase } from './supabase'

const AVATAR = (id, avatar) =>
  avatar
    ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=64`
    : null

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || ''

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

export function mapParticipant(p) {
  const id = p.id || p.user?.id
  return {
    id,
    name: p.nickname || p.username || p.user?.global_name || p.user?.username || 'Kindred',
    avatar: AVATAR(id, p.avatar || p.user?.avatar),
    source: 'discord',
  }
}

export async function readParticipants(sdk) {
  if (!sdk) return []
  const { participants } = await sdk.commands.getInstanceConnectedParticipants()
  return (participants || []).map(mapParticipant).filter((p) => p.id)
}

export function subscribeParticipants(sdk, onChange) {
  if (!sdk) return () => {}
  const handler = (event) => {
    onChange((event.participants || []).map(mapParticipant).filter((p) => p.id))
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

async function exchangeDiscordCode(code) {
  if (!supabase) throw new Error('no supabase')
  const { data, error } = await supabase.functions.invoke('discord-token', { body: { code } })
  if (error || !data?.access_token) throw error || new Error('token')
  return data.access_token
}

export async function authenticateDiscordUser(sdk, clientId) {
  const { code } = await sdk.commands.authorize({
    client_id: clientId,
    response_type: 'code',
    prompt: 'none',
    scope: ['identify', 'guilds', 'rpc.activities.write'],
  })
  const accessToken = await exchangeDiscordCode(code)
  const auth = await sdk.commands.authenticate({ access_token: accessToken })
  const user = auth.user
  return {
    id: user.id,
    name: user.global_name || user.username,
    avatar: AVATAR(user.id, user.avatar),
    color: colorFromName(user.global_name || user.username),
    source: 'discord',
  }
}

export async function connectDiscord(clientId = CLIENT_ID) {
  if (!clientId || !isLikelyEmbedded()) return { sdk: null, user: null }
  const mod = await import('@discord/embedded-app-sdk')
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  if (supabaseUrl) {
    try {
      const host = new URL(supabaseUrl).host
      mod.patchUrlMappings([{ prefix: '/supabase', target: host }])
    } catch {
      /* ignore */
    }
  }
  const sdk = new mod.DiscordSDK(clientId)
  await Promise.race([
    sdk.ready(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Discord SDK timeout')), 8000)
    }),
  ])
  let user = null
  try {
    user = await authenticateDiscordUser(sdk, clientId)
  } catch {
    user = null
  }
  return { sdk, user }
}
