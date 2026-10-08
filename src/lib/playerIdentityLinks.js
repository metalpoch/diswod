import { supabase } from './supabase'
import { DM_PRESENCE_MAX_PARTICIPANTS } from './dmPresence'

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

export function createIdentityClaimContextGuard(context, getCurrentContext) {
  return () => identityClaimContextMatches(
    context,
    typeof getCurrentContext === 'function' ? getCurrentContext() : null,
  )
}

export function identityClaimSelection(candidate, context) {
  if (!candidate?.playerId) return null
  return {
    candidate: { playerId: candidate.playerId, playerName: candidate.playerName, role: candidate.role },
    context: context ? {
      mesaId: context.mesaId,
      discordUserId: context.discordUserId,
      generation: context.generation,
      contextGeneration: context.contextGeneration,
    } : null,
    requiresConfirmation: candidate.role === 'dm',
  }
}

export function identityClaimRequestMatches(expectedContext, expectedCandidate, currentContext, currentCandidate) {
  return Boolean(
    identityClaimContextMatches(expectedContext, currentContext)
    && expectedCandidate?.playerId
    && expectedCandidate.playerId === currentCandidate?.playerId
    && expectedCandidate.role === currentCandidate?.role,
  )
}

export function identityClaimSelectionIsCurrent(selection, claim) {
  if (!selection || !claim?.context) return false
  const candidate = claim.candidates?.find((row) => row?.playerId === selection.candidate?.playerId)
  return identityClaimRequestMatches(selection.context, selection.candidate, claim.context, candidate)
}

export function chooseIdentityClaimCandidate(candidate, { context, onSelectDm, onClaim }) {
  const selection = identityClaimSelection(candidate, context)
  if (!selection) return 'invalid'
  if (selection.requiresConfirmation) {
    onSelectDm(selection)
    return 'confirmation'
  }
  onClaim(selection.candidate.playerId, false, selection.context)
  return 'claimed'
}

export function cancelIdentityClaimSelection(onCancel) {
  onCancel?.(null)
  return null
}

export async function confirmIdentityClaim({ selection, currentClaim, isCurrent, claim }) {
  if (
    !identityClaimSelectionIsCurrent(selection, currentClaim)
    || typeof isCurrent !== 'function'
    || !isCurrent(selection.context, selection.candidate.playerId, selection.candidate.role)
  ) return false
  await claim(
    selection.candidate.playerId,
    selection.candidate.role === 'dm',
    selection.context,
    selection.candidate.role,
  )
  return true
}

export async function claimAndJoinLinkedIdentity({ claim, isCurrent, storeLink, join }) {
  const claimedPlayerId = await claim()
  if (!isCurrent()) return { cancelled: true, claimedPlayerId }

  const identity = storeLink(claimedPlayerId)
  if (!isCurrent()) return { cancelled: true, claimedPlayerId, identity }

  const joined = await join(identity)
  if (!isCurrent()) return { cancelled: true, claimedPlayerId, identity, joined }
  return { cancelled: false, claimedPlayerId, identity, joined }
}

const IDENTITY_ERROR_MESSAGES = {
  dm_confirmation_required: 'Para vincular la fila del Narrador, confirma explícitamente que eres el Narrador de esta mesa.',
  invalid_candidate: 'Esta fila ya no está disponible para vincular. Actualiza la lista e inténtalo de nuevo.',
  invalid_invite: 'El código de invitación ya no es válido para esta mesa.',
  conflict: 'Otro jugador ya vinculó esta fila. Se ha actualizado la lista disponible.',
  discord_auth_required: 'Discord debe verificar tu cuenta para reclamar una identidad de mesa.',
  discord_verification_failed: 'No se pudo verificar tu cuenta de Discord. Vuelve a iniciar sesión e inténtalo de nuevo.',
  invalid_request: 'No se pudo completar la solicitud de vínculo. Actualiza la lista e inténtalo de nuevo.',
  transient: 'No se pudo verificar la identidad de mesa. Comprueba tu conexión e inténtalo de nuevo.',
}

export const CLAIM_COMPLETION_FALLBACK = 'No se pudo completar la vinculación. El vínculo puede haberse guardado; vuelve a entrar con el código o contacta Narrador.'

const CLAIM_FAILURE_MESSAGES = {
  CLAIM_DM_CONFIRMATION_REQUIRED: IDENTITY_ERROR_MESSAGES.dm_confirmation_required,
  CLAIM_INVALID_CANDIDATE: IDENTITY_ERROR_MESSAGES.invalid_candidate,
  CLAIM_INVALID_INVITE: IDENTITY_ERROR_MESSAGES.invalid_invite,
  CLAIM_CONFLICT: IDENTITY_ERROR_MESSAGES.conflict,
  CLAIM_DISCORD_AUTH_REQUIRED: IDENTITY_ERROR_MESSAGES.discord_auth_required,
  CLAIM_DISCORD_VERIFICATION_FAILED: IDENTITY_ERROR_MESSAGES.discord_verification_failed,
  CLAIM_INVALID_REQUEST: IDENTITY_ERROR_MESSAGES.invalid_request,
  CLAIM_TRANSIENT: IDENTITY_ERROR_MESSAGES.transient,
}

export function identityClaimFailureMessage(error, claimPersisted = false) {
  if (claimPersisted) return CLAIM_COMPLETION_FALLBACK
  const code = error?.code
  return Object.prototype.hasOwnProperty.call(CLAIM_FAILURE_MESSAGES, code)
    ? CLAIM_FAILURE_MESSAGES[code]
    : CLAIM_COMPLETION_FALLBACK
}

export function identityClaimFailureState(pending, error, claimPersisted = false) {
  return {
    ...pending,
    error: identityClaimFailureMessage(error, claimPersisted),
    busy: false,
  }
}

const KNOWN_IDENTITY_ERROR_CODES = new Set([
  'dm_confirmation_required',
  'invalid_candidate',
  'invalid_invite',
  'conflict',
  'discord_auth_required',
  'discord_verification_failed',
  'invalid_request',
])

async function responseErrorCode(context) {
  if (!context || typeof context.clone !== 'function') return ''
  try {
    const response = context.clone()
    if (!response || typeof response.json !== 'function') return ''
    const body = await response.json()
    return typeof body?.error === 'string' && KNOWN_IDENTITY_ERROR_CODES.has(body.error)
      ? body.error
      : ''
  } catch {
    return ''
  }
}

export function identityFunctionErrorCode(status, responseCode = '') {
  if (KNOWN_IDENTITY_ERROR_CODES.has(responseCode)) return responseCode
  if (status === 401) return 'discord_auth_required'
  if (status === 409) return 'conflict'
  return 'transient'
}

async function invokeIdentityFunction(accessToken, body) {
  if (!supabase || !accessToken) throw new Error('Se requiere una sesión autenticada de Discord para vincular una identidad.')
  const { data, error } = await supabase.functions.invoke('mesa-player-identity', {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (error) {
    const status = error.context?.status
    const responseCode = await responseErrorCode(error.context)
    const code = identityFunctionErrorCode(status, responseCode)
    const failure = new Error(IDENTITY_ERROR_MESSAGES[code])
    failure.code = code === 'conflict' ? 'CLAIM_CONFLICT' : `CLAIM_${code.toUpperCase()}`
    throw failure
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

const DISCORD_ID_PATTERN = /^\d{17,20}$/
const DM_PRESENCE_STATUSES = new Set(['online', 'offline', 'unlinked', 'unknown'])

export async function getDmPresence(accessToken, mesaId, participants) {
  if (!Array.isArray(participants) || participants.length > DM_PRESENCE_MAX_PARTICIPANTS) return 'unknown'
  const participantIds = []
  for (const participant of participants) {
    const id = participant?.id
    if (typeof id !== 'string' || id.length > 20 || !DISCORD_ID_PATTERN.test(id)) return 'unknown'
    if (!participantIds.includes(id)) participantIds.push(id)
  }
  if (!supabase || !accessToken || !mesaId || participantIds.length === 0) return 'unknown'
  try {
    const { data, error } = await supabase.functions.invoke('mesa-player-identity', {
      body: { action: 'dm_presence', mesa_id: mesaId, participant_ids: participantIds },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (error || !DM_PRESENCE_STATUSES.has(data?.status)) return 'unknown'
    return data.status
  } catch {
    return 'unknown'
  }
}
