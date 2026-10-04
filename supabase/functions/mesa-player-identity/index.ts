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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)
  if (!backendUrl || !serviceKey) return jsonResponse({ error: 'service_unavailable' }, 503)

  const bearer = req.headers.get('Authorization') || ''
  const tokenMatch = bearer.match(/^Bearer\s+([^\s]+)$/i)
  if (!tokenMatch) return jsonResponse({ error: 'discord_auth_required' }, 401)

  let discordUserId: string
  try {
    const discordResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenMatch[1]}` },
    })
    if (!discordResponse.ok) return jsonResponse({ error: 'discord_auth_required' }, 401)
    const user = await discordResponse.json()
    if (typeof user?.id !== 'string' || !user.id) return jsonResponse({ error: 'discord_auth_required' }, 401)
    discordUserId = user.id
  } catch {
    return jsonResponse({ error: 'discord_verification_failed' }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }

  try {
    if (body.action === 'resolve') {
      const links = await serviceQuery(
        `mesa_player_identity_links?discord_user_id=eq.${encodeURIComponent(discordUserId)}&select=mesa_id,player_id`,
      )
      return jsonResponse({ links })
    }

    if (body.action === 'candidates' || body.action === 'claim') {
      const mesaId = typeof body.mesa_id === 'string' ? body.mesa_id : ''
      const inviteCode = typeof body.invite_code === 'string' ? body.invite_code : ''
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mesaId)) {
        return jsonResponse({ error: 'invalid_request' }, 400)
      }
      if (!inviteCode) return jsonResponse({ error: 'invalid_invite' }, 403)

      const invitedMesa = await serviceQuery(
        `mesas?id=eq.${mesaId}&invite_code=eq.${encodeURIComponent(inviteCode)}&select=id&limit=1`,
      )
      if (!invitedMesa?.length) return jsonResponse({ error: 'invalid_invite' }, 403)

      if (body.action === 'candidates') {
        const accountLinks = await serviceQuery(
          `mesa_player_identity_links?mesa_id=eq.${mesaId}&discord_user_id=eq.${encodeURIComponent(discordUserId)}&select=player_id&limit=1`,
        )
        const directMembers = await serviceQuery(
          `mesa_members?mesa_id=eq.${mesaId}&player_id=eq.${encodeURIComponent(discordUserId)}&select=player_id,player_name,role&limit=1`,
        )
        if (accountLinks?.[0]?.player_id) {
          return jsonResponse({
            linked_player_id: accountLinks[0].player_id,
            direct_member: directMembers?.[0] || null,
            candidates: [],
          })
        }
        const memberFilters = new URLSearchParams({
          mesa_id: `eq.${mesaId}`,
          player_id: 'like.local-*',
          role: 'in.(dm,player)',
          select: 'player_id,player_name,role',
        })
        const [members, claimed] = await Promise.all([
          serviceQuery(`mesa_members?${memberFilters}`),
          serviceQuery(`mesa_player_identity_links?mesa_id=eq.${mesaId}&select=player_id`),
        ])
        const claimedIds = new Set((claimed || []).map((row: { player_id: string }) => row.player_id))
        const candidates = (members || []).filter((row: { player_id: string }) => !claimedIds.has(row.player_id))
        return jsonResponse({ direct_member: directMembers?.[0] || null, candidates })
      }

      const playerId = typeof body.player_id === 'string' ? body.player_id : ''
      if (!playerId) return jsonResponse({ error: 'invalid_request' }, 400)
      const result = await serviceQuery('rpc/claim_legacy_mesa_player', {
        method: 'POST',
        body: JSON.stringify({
          p_mesa_id: mesaId,
          p_discord_user_id: discordUserId,
          p_player_id: playerId,
          p_invite_code: inviteCode,
          p_confirmed_dm: body.confirmed_dm === true,
        }),
      })
      if (result?.status === 'claimed') return jsonResponse({ player_id: result.player_id })
      if (result?.status === 'conflict') return jsonResponse({ error: 'conflict' }, 409)
      if (result?.status === 'invalid_invite') return jsonResponse({ error: 'invalid_invite' }, 403)
      return jsonResponse({ error: 'invalid_candidate' }, 400)
    }
    return jsonResponse({ error: 'invalid_request' }, 400)
  } catch {
    // Never return backend or Discord response details; they may contain identifying data.
    return jsonResponse({ error: 'identity_service_unavailable' }, 503)
  }
})
