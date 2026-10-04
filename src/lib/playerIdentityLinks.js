import { supabase } from './supabase'

export function normalizeIdentityLinks(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.mesa_id && row?.player_id)
    .map(({ mesa_id, player_id }) => ({ mesaId: mesa_id, playerId: player_id }))
}

export function identityMesaPairs(identity) {
  const pairs = new Map()
  for (const link of identity?.links || []) {
    if (link?.mesaId && link?.playerId) pairs.set(`${link.mesaId}\u0000${link.playerId}`, {
      mesaId: link.mesaId,
      playerId: link.playerId,
    })
  }
  return [...pairs.values()]
}

export function identityMembershipPairs(identity, directMemberships = []) {
  const pairs = new Map()
  for (const row of directMemberships || []) {
    if (row?.mesa_id && row?.player_id) pairs.set(`${row.mesa_id}\u0000${row.player_id}`, {
      mesa_id: row.mesa_id,
      player_id: row.player_id,
    })
  }
  for (const link of identityMesaPairs(identity)) {
    pairs.set(`${link.mesaId}\u0000${link.playerId}`, { mesa_id: link.mesaId, player_id: link.playerId })
  }
  return [...pairs.values()]
}

export function effectivePlayerId(identity, mesaId) {
  return identity?.links?.find((link) => link.mesaId === mesaId)?.playerId || identity?.id || ''
}

export function availableLegacyCandidates(rows, claimedPlayerIds = []) {
  const claimed = new Set(claimedPlayerIds)
  return (Array.isArray(rows) ? rows : []).filter((row) => (
    String(row?.player_id || '').startsWith('local-')
    && (row.role === 'dm' || row.role === 'player')
    && !claimed.has(row.player_id)
  ))
}

export function identityWithMesaClaim(identity, mesaId, playerId) {
  if (!identity || !mesaId || !playerId) return identity
  return {
    ...identity,
    links: [...(identity.links || []).filter((link) => link.mesaId !== mesaId), { mesaId, playerId }],
  }
}

export function isVerifiedClaimIdentity(identity, accessToken) {
  return Boolean(accessToken && identity?.source === 'discord-auth' && identity?.discordId === identity?.id)
}

export function canUsePersistentIdentity(identity, embedded) {
  if (identity?.source === 'discord-auth' && identity?.discordId === identity?.id) return true
  return !embedded && identity?.source === 'local' && String(identity.id || '').startsWith('local-')
}

export function identityClaimContextMatches(context, current) {
  return Boolean(
    context
    && current
    && context.mesaId === current.mesaId
    && context.discordUserId === current.discordUserId
    && context.generation === current.generation
    && context.contextGeneration === current.contextGeneration,
  )
}

async function invokeIdentityFunction(accessToken, body) {
  if (!supabase || !accessToken) throw new Error('Se requiere una sesión autenticada de Discord para vincular una identidad.')
  const { data, error } = await supabase.functions.invoke('mesa-player-identity', {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (error) {
    const status = error.context?.status
    if (status === 409 || data?.error === 'conflict') {
      const conflict = new Error('Otro jugador ya vinculó esta fila. Se ha actualizado la lista disponible.')
      conflict.code = 'CLAIM_CONFLICT'
      throw conflict
    }
    if (status === 401) throw new Error('Discord debe verificar tu cuenta para reclamar una identidad de mesa.')
    throw new Error(data?.message || 'No se pudo verificar la identidad de mesa.')
  }
  return data
}

export async function resolvePlayerIdentityLinks(accessToken) {
  const data = await invokeIdentityFunction(accessToken, { action: 'resolve' })
  return normalizeIdentityLinks(data?.links)
}

export async function getLegacyClaimCandidates(accessToken, mesaId, inviteCode) {
  const data = await invokeIdentityFunction(accessToken, { action: 'candidates', mesa_id: mesaId, invite_code: inviteCode })
  return {
    linkedPlayerId: data?.linked_player_id || '',
    directMember: data?.direct_member?.player_id
      ? {
        playerId: data.direct_member.player_id,
        playerName: data.direct_member.player_name || 'Miembro actual',
      }
      : null,
    candidates: (data?.candidates || []).filter((row) => row?.player_id && row?.player_name)
      .map((row) => ({ playerId: row.player_id, playerName: row.player_name, role: row.role })),
  }
}

export async function claimLegacyPlayer(accessToken, mesaId, playerId, inviteCode, confirmedDm = false) {
  const data = await invokeIdentityFunction(accessToken, {
    action: 'claim',
    mesa_id: mesaId,
    player_id: playerId,
    invite_code: inviteCode,
    confirmed_dm: confirmedDm,
  })
  return data?.player_id || playerId
}
