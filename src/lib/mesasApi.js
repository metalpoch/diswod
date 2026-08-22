import { canPromote, makeInviteCode, mapMember, normalizeInvite } from './invite'
import { supabase } from './supabase'

function mapMesa(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    kind: row.kind || 'principal',
    status: row.status,
    createdBy: row.created_by,
    dmId: row.dm_id || '',
    inviteCode: row.invite_code || '',
    currentSessionId: row.current_session_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    myRole: row.my_role || null,
  }
}

async function uniqueInvite() {
  for (let i = 0; i < 10; i += 1) {
    const code = makeInviteCode()
    const { data } = await supabase.from('mesas').select('id').eq('invite_code', code).maybeSingle()
    if (!data) return code
  }
  return makeInviteCode() + makeInviteCode().slice(0, 2)
}

export async function listMyMesas(playerId) {
  const { data, error } = await supabase
    .from('mesa_members')
    .select('role, mesas(*)')
    .eq('player_id', playerId)
  if (error) throw error
  return (data || [])
    .map((row) => mapMesa(row.mesas ? { ...row.mesas, my_role: row.role } : null))
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

export async function getMesa(id) {
  const { data, error } = await supabase.from('mesas').select('*').eq('id', id).single()
  if (error) throw error
  return mapMesa(data)
}

export async function getMesaByCode(code) {
  const invite = normalizeInvite(code)
  if (!invite) return null
  const { data, error } = await supabase.from('mesas').select('*').eq('invite_code', invite).maybeSingle()
  if (error) throw error
  return mapMesa(data)
}

export async function createMesa({ name, description, kind, identity }) {
  const invite = await uniqueInvite()
  const { data, error } = await supabase
    .from('mesas')
    .insert({
      name: name.trim(),
      description: (description || '').trim(),
      kind: kind || 'principal',
      created_by: identity?.id || '',
      dm_id: identity?.id || '',
      invite_code: invite,
      status: 'active',
    })
    .select('*')
    .single()
  if (error) throw error
  await addMember(data.id, identity, 'dm')
  const mesa = mapMesa(data)
  const session = await createSession(mesa.id, 'Sesión 1')
  return setCurrentSession(mesa.id, session.id)
}

export async function addMember(mesaId, identity, role) {
  const { data, error } = await supabase
    .from('mesa_members')
    .upsert({
      mesa_id: mesaId,
      player_id: identity.id,
      player_name: identity.name || 'Kindred',
      avatar: identity.avatar || null,
      role,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapMember(data)
}

export async function joinByCode(code, identity) {
  const mesa = await getMesaByCode(code)
  if (!mesa) throw new Error('Código inválido')
  const members = await listMembers(mesa.id)
  const existing = members.find((m) => m.player_id === identity.id)
  if (existing) return { mesa, member: existing }
  const role = canPromote(members) ? 'player' : 'visitor'
  const member = await addMember(mesa.id, identity, role)
  return { mesa, member }
}

export async function listMembers(mesaId) {
  const { data, error } = await supabase
    .from('mesa_members')
    .select('*')
    .eq('mesa_id', mesaId)
    .order('joined_at', { ascending: true })
  if (error) throw error
  return (data || []).map(mapMember)
}

export async function setMemberRole(mesaId, playerId, role, members) {
  if (role !== 'visitor' && !canPromote(members.filter((m) => m.player_id !== playerId))) {
    throw new Error('La mesa ya tiene 4 jugadores')
  }
  if (role === 'dm') {
    await supabase.from('mesa_members').update({ role: 'player' }).eq('mesa_id', mesaId).eq('role', 'dm')
    await supabase.from('mesas').update({ dm_id: playerId, updated_at: new Date().toISOString() }).eq('id', mesaId)
  }
  const { error } = await supabase
    .from('mesa_members')
    .update({ role })
    .eq('mesa_id', mesaId)
    .eq('player_id', playerId)
  if (error) throw error
}

export async function kickMember(mesaId, playerId) {
  const { error } = await supabase
    .from('mesa_members')
    .delete()
    .eq('mesa_id', mesaId)
    .eq('player_id', playerId)
  if (error) throw error
}

export async function leaveMesa(mesaId, identity, members) {
  const me = members.find((m) => m.player_id === identity.id)
  await kickMember(mesaId, identity.id)
  if (me?.role === 'dm') {
    const next = members.find((m) => m.player_id !== identity.id && (m.role === 'player' || m.role === 'visitor'))
    if (next) {
      await setMemberRole(mesaId, next.player_id, 'dm', members.filter((m) => m.player_id !== identity.id))
    }
  }
}

export function subscribeMembers(mesaId, onChange) {
  const channel = supabase
    .channel(`members-${mesaId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'mesa_members', filter: `mesa_id=eq.${mesaId}` },
      () => {
        listMembers(mesaId).then(onChange).catch(() => {})
      },
    )
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}

export async function setMesaStatus(id, status) {
  const { data, error } = await supabase
    .from('mesas')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return mapMesa(data)
}

export async function createSession(mesaId, title) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({ mesa_id: mesaId, title })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function setCurrentSession(mesaId, sessionId) {
  const { data, error } = await supabase
    .from('mesas')
    .update({ current_session_id: sessionId, updated_at: new Date().toISOString() })
    .eq('id', mesaId)
    .select('*')
    .single()
  if (error) throw error
  return mapMesa(data)
}

export async function listSessions(mesaId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('mesa_id', mesaId)
    .order('started_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function loadLog(mesaId) {
  const { data, error } = await supabase
    .from('log_entries')
    .select('payload')
    .eq('mesa_id', mesaId)
    .order('ts', { ascending: true })
  if (error) throw error
  return (data || []).map((row) => row.payload).filter(Boolean)
}

export async function saveLogEntry(mesaId, sessionId, entry) {
  const { error } = await supabase.from('log_entries').upsert({
    id: entry.id,
    mesa_id: mesaId,
    session_id: sessionId || null,
    ts: new Date(entry.ts).toISOString(),
    player_id: entry.player?.id || null,
    player_name: entry.player?.name || null,
    payload: entry,
  })
  if (error) throw error
}

export function subscribeLog(mesaId, onInsert) {
  const channel = supabase
    .channel(`log-${mesaId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'log_entries', filter: `mesa_id=eq.${mesaId}` },
      (payload) => {
        if (payload.new?.payload) onInsert(payload.new.payload)
      },
    )
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}

export async function loadNotes(mesaId, playerId) {
  const { data, error } = await supabase
    .from('player_notes')
    .select('*')
    .eq('mesa_id', mesaId)
    .eq('player_id', playerId)
    .maybeSingle()
  if (error) throw error
  return data || { character_name: '', body: '' }
}

export async function saveNotes(mesaId, playerId, { characterName, body }) {
  const { error } = await supabase.from('player_notes').upsert({
    mesa_id: mesaId,
    player_id: playerId,
    character_name: characterName || '',
    body: body || '',
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function loadBoard(mesaId, playerId) {
  const { data, error } = await supabase
    .from('player_boards')
    .select('strokes')
    .eq('mesa_id', mesaId)
    .eq('player_id', playerId)
    .maybeSingle()
  if (error) throw error
  return data?.strokes || []
}

export async function saveBoard(mesaId, playerId, strokes) {
  const { error } = await supabase.from('player_boards').upsert({
    mesa_id: mesaId,
    player_id: playerId,
    strokes,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export function persistMesaParam(id) {
  const url = new URL(window.location.href)
  if (id) url.searchParams.set('mesa', id)
  else url.searchParams.delete('mesa')
  window.history.replaceState({}, '', url)
}

export function mesaFromLocation() {
  return new URLSearchParams(window.location.search).get('mesa') || ''
}

export function codeFromLocation() {
  return normalizeInvite(new URLSearchParams(window.location.search).get('code') || '')
}

export async function deleteMyData(playerId) {
  if (!supabase || !playerId) throw new Error('Falta identidad')

  const { data: logs } = await supabase
    .from('log_entries')
    .select('id, payload')
    .eq('player_id', playerId)
  for (const row of logs || []) {
    const payload = {
      ...(row.payload || {}),
      player: { id: 'deleted', name: 'Eliminado' },
    }
    await supabase
      .from('log_entries')
      .update({ payload, player_id: null, player_name: 'Eliminado' })
      .eq('id', row.id)
  }

  const { data: memberships } = await supabase
    .from('mesa_members')
    .select('mesa_id, role')
    .eq('player_id', playerId)

  for (const row of memberships || []) {
    if (row.role !== 'dm') continue
    const { data: others } = await supabase
      .from('mesa_members')
      .select('player_id, role')
      .eq('mesa_id', row.mesa_id)
    const next = (others || []).find((m) => m.player_id !== playerId)
    if (next) {
      await supabase.from('mesa_members').update({ role: 'dm' }).eq('mesa_id', row.mesa_id).eq('player_id', next.player_id)
      await supabase.from('mesas').update({ dm_id: next.player_id, updated_at: new Date().toISOString() }).eq('id', row.mesa_id)
    }
  }

  const notes = await supabase.from('player_notes').delete().eq('player_id', playerId)
  if (notes.error) throw notes.error
  const boards = await supabase.from('player_boards').delete().eq('player_id', playerId)
  if (boards.error) throw boards.error
  const members = await supabase.from('mesa_members').delete().eq('player_id', playerId)
  if (members.error) throw members.error
}
