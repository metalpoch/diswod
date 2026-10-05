import { canControlScene, resolveDmActor, validServerMusicSelection } from '../_shared/scenePolicy.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json' },
})
const backendUrl = Deno.env.get('SUPABASE_URL') || ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function serviceQuery(path: string, init: RequestInit = {}) {
  const response = await fetch(`${backendUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  if (!response.ok) throw new Error('backend_failure')
  return response.status === 204 ? null : response.json()
}

function queryPath(table: string, filters: Record<string, string>, select: string) {
  const params = new URLSearchParams({ ...filters, select, limit: '1' })
  return `${table}?${params}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)
  if (!backendUrl || !serviceKey) return jsonResponse({ error: 'service_unavailable' }, 503)
  const tokenMatch = (req.headers.get('Authorization') || '').match(/^Bearer\s+([^\s]+)$/i)
  if (!tokenMatch) return jsonResponse({ error: 'discord_auth_required' }, 401)

  let discordUserId = ''
  try {
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenMatch[1]}` },
    })
    if (!response.ok) return jsonResponse({ error: 'discord_auth_required' }, 401)
    const user = await response.json()
    if (typeof user?.id !== 'string' || !user.id) return jsonResponse({ error: 'discord_auth_required' }, 401)
    discordUserId = user.id
  } catch {
    return jsonResponse({ error: 'discord_verification_failed' }, 401)
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return jsonResponse({ error: 'invalid_request' }, 400) }
  const mesaId = typeof body.mesa_id === 'string' ? body.mesa_id : ''
  if (!uuidPattern.test(mesaId)) return jsonResponse({ error: 'invalid_request' }, 400)

  try {
    const directRows = await serviceQuery(queryPath('mesa_members', {
      mesa_id: `eq.${mesaId}`, player_id: `eq.${discordUserId}`,
    }, 'player_id,role')) as Array<{ player_id: string; role: string }>
    const directMember = directRows?.[0] || null
    const linkRows = await serviceQuery(queryPath('mesa_player_identity_links', {
      mesa_id: `eq.${mesaId}`, discord_user_id: `eq.${discordUserId}`,
    }, 'mesa_id,player_id')) as Array<{ mesa_id: string; player_id: string }>
    const legacyLink = linkRows?.[0] || null
    let linkedMember = null
    if (legacyLink?.player_id) {
      const linkedRows = await serviceQuery(queryPath('mesa_members', {
        mesa_id: `eq.${mesaId}`, player_id: `eq.${legacyLink.player_id}`,
      }, 'player_id,role')) as Array<{ player_id: string; role: string }>
      linkedMember = linkedRows?.[0] || null
    }
    const actor = resolveDmActor({ discordUserId, mesaId, directMember, legacyLink, linkedMember })
    if (!actor.authorized) return jsonResponse({ error: 'dm_required' }, 403)

    if (body.action === 'music') {
      const mode = typeof body.mode === 'string' ? body.mode : ''
      const trackId = typeof body.track_id === 'string' ? body.track_id : null
      if (!validServerMusicSelection(mode, trackId)) return jsonResponse({ error: 'invalid_music_selection' }, 400)
      const updatedAt = new Date().toISOString()
      const rows = await serviceQuery('mesa_scene_settings?on_conflict=mesa_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({ mesa_id: mesaId, music_mode: mode, track_id: mode === 'track' ? trackId : null, updated_by: actor.playerId, updated_at: updatedAt }),
      })
      return jsonResponse({ setting: rows?.[0] || null })
    }

    if (body.action === 'condition') {
      const playerId = typeof body.player_id === 'string' ? body.player_id : ''
      const key = typeof body.key === 'string' ? body.key : ''
      const active = body.active === true
      if (!playerId || typeof body.active !== 'boolean') return jsonResponse({ error: 'invalid_condition' }, 400)
      const targetRows = await serviceQuery(queryPath('mesa_members', {
        mesa_id: `eq.${mesaId}`, player_id: `eq.${playerId}`,
      }, 'player_id,role')) as Array<{ player_id: string; role: string }>
      const target = targetRows?.[0]
      if (!canControlScene({
        mesaId,
        requestedMesaId: typeof body.mesa_id === 'string' ? body.mesa_id : '',
        actorRole: 'dm',
        targetMesaId: target ? mesaId : '',
        targetRole: target?.role || '',
        conditionKey: key,
      })) return jsonResponse({ error: 'invalid_target' }, 403)

      const updatedAt = new Date().toISOString()
      const rows = await serviceQuery('mesa_player_conditions?on_conflict=mesa_id,player_id,key', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({ mesa_id: mesaId, player_id: playerId, key, active, updated_by: actor.playerId, updated_at: updatedAt }),
      })
      return jsonResponse({ condition: rows?.[0] || null })
    }
    return jsonResponse({ error: 'invalid_request' }, 400)
  } catch {
    return jsonResponse({ error: 'scene_service_unavailable' }, 503)
  }
})
