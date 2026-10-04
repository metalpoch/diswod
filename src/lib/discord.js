import { supabase } from './supabase'
import {
  categorizedStartupError,
  loadSdkModule,
  startupFailureCategory,
  waitForSdkReady,
} from './activityStartup'

const AVATAR = (id, avatar) =>
  avatar
    ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=64`
    : null

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || ''
const DISCORD_OAUTH_SCOPES = ['identify']

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
  try {
    localStorage.setItem('diswod.identity', JSON.stringify(identity))
  } catch {
    /* Identity remains available in React state when storage is unavailable. */
  }
}

export function clearIdentity() {
  try {
    localStorage.removeItem('diswod.identity')
  } catch {
    /* Ignore storage being unavailable in the Activity sandbox. */
  }
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

export async function subscribeParticipants(sdk, onChange) {
  if (!sdk) return () => {}
  const handler = (event) => {
    onChange((event.participants || []).map(mapParticipant).filter((p) => p.id))
  }
  const unsubscribe = () => {
    try {
      return Promise.resolve(sdk.unsubscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', handler)).catch(() => {})
    } catch {
      /* ignore */
    }
  }
  try {
    await sdk.subscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', handler)
  } catch (error) {
    try {
      await unsubscribe()
    } catch {
      /* A failed registration may still have partially attached the handler. */
    }
    throw error
  }
  return unsubscribe
}

async function exchangeDiscordCode(code) {
  try {
    if (!supabase) throw new Error()
    const { data, error } = await supabase.functions.invoke('discord-token', { body: { code } })
    if (error || !data?.access_token) throw new Error()
    return data.access_token
  } catch {
    throw categorizedStartupError('discord_token')
  }
}

export async function authenticateDiscordUser(sdk, clientId) {
  let code
  try {
    ({ code } = await sdk.commands.authorize({
      client_id: clientId,
      response_type: 'code',
      prompt: 'none',
      scope: DISCORD_OAUTH_SCOPES,
    }))
  } catch {
    throw categorizedStartupError('oauth_authorize')
  }
  const accessToken = await exchangeDiscordCode(code)
  let user
  try {
    const auth = await sdk.commands.authenticate({ access_token: accessToken })
    user = auth.user
  } catch {
    throw categorizedStartupError('oauth_authenticate')
  }
  return {
    id: user.id,
    discordId: user.id,
    name: user.global_name || user.username,
    avatar: AVATAR(user.id, user.avatar),
    color: colorFromName(user.global_name || user.username),
    source: 'discord-auth',
    accessToken,
  }
}

export async function connectDiscord(clientId = CLIENT_ID, { signal } = {}) {
  if (!isLikelyEmbedded()) return { sdk: null, user: null }
  if (!clientId) return { sdk: null, user: null, failureCategory: 'client_id_missing' }
  const imported = await loadSdkModule(() => import('@discord/embedded-app-sdk'), { signal })
  if (imported.cancelled || signal?.aborted) return { sdk: null, user: null, cancelled: true }
  const mod = imported.module
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  if (supabaseUrl) {
    try {
      const host = new URL(supabaseUrl).host
      mod.patchUrlMappings([{ prefix: '/supabase', target: host }])
    } catch {
      /* ignore */
    }
  }
  let sdk
  try {
    sdk = new mod.DiscordSDK(clientId)
  } catch {
    throw categorizedStartupError('sdk_initialize')
  }
  const ready = await waitForSdkReady(() => sdk.ready(), { signal })
  if (!ready || signal?.aborted) return { sdk: null, user: null, cancelled: true }
  let user = null
  let accessToken = ''
  let authFailureCategory = ''
  try {
    const authenticated = await authenticateDiscordUser(sdk, clientId)
    const { accessToken: token, ...profile } = authenticated
    user = profile
    accessToken = token
  } catch (error) {
    authFailureCategory = startupFailureCategory(error)
    if (authFailureCategory === 'activity_startup') authFailureCategory = 'oauth_authenticate'
    user = null
  }
  return { sdk, user, accessToken, authFailureCategory }
}
