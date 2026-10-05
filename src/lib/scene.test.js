import { describe, expect, it } from 'vitest'
import manifest from '../../public/audio/manifest.json'
import {
  buildSceneConditionUpdate,
  buildFrenzyUpdate,
  canAutoplayMusic,
  clearMusicTimer,
  frenzyForPlayer,
  getFrenzyPlayerIds,
  getSceneConditionPlayerIds,
  musicErrorTransition,
  normalizeMusicSetting,
  normalizeTrackList,
  SCENE_CONTROL_AUTH_MESSAGE,
  SCENE_CONTROL_DISCORD_AUTH_MESSAGE,
  SCENE_CONTROL_DM_MESSAGE,
  SCENE_CONTROL_LOCAL_MESSAGE,
  SCENE_CONTROL_PARTICIPANT_MESSAGE,
  SCENE_CONTROL_REJECTED_MESSAGE,
  SCENE_CONTROL_RETRY_MESSAGE,
  SCENE_CONTROL_TOKEN_MESSAGE,
  SCENE_CONDITION_KEYS,
  SCENE_CONDITION_LABELS,
  sceneConditionForPlayer,
  sceneConditionForPlayerIsActive,
  sceneControlAccessMessage,
  sceneControlErrorDetails,
  sameSceneContext,
  validMusicSelection,
} from './scene'
import { SCENE_CONDITION_KEYS as SERVER_SCENE_CONDITION_KEYS, SCENE_TRACK_IDS, validServerMusicSelection } from '../../supabase/functions/_shared/scenePolicy'
import {
  canControlScene,
  resolveDmActor,
} from '../../supabase/functions/_shared/scenePolicy'

const tracks = normalizeTrackList(manifest.tracks)
const trackIds = tracks.map((track) => track.id)
const mesaId = 'mesa-a'

describe('scene playback context', () => {
  it('does not autoplay a persisted scene before settings are ready, including saved off', () => {
    expect(canAutoplayMusic({ persisted: true, ready: false, mode: 'auto' })).toBe(false)
    expect(canAutoplayMusic({ persisted: true, ready: false, mode: 'off' })).toBe(false)
    expect(canAutoplayMusic({ persisted: true, ready: true, mode: 'off' })).toBe(false)
    expect(canAutoplayMusic({ persisted: false, ready: false, mode: 'auto' })).toBe(true)
  })

  it('keeps failed scene reads gated rather than allowing automatic playback', () => {
    const failedRead = { persisted: true, ready: false, mode: 'auto', error: 'read failed' }
    expect(failedRead.error).toBeTruthy()
    expect(canAutoplayMusic(failedRead)).toBe(false)
  })

  it('falls back from a chosen track once, then stops on another playback error', () => {
    const fallback = musicErrorTransition({ mode: 'track', fallbackUsed: false })
    expect(fallback).toEqual({ fallbackUsed: true, stopped: false })
    expect(musicErrorTransition({ mode: 'auto', fallbackUsed: fallback.fallbackUsed }))
      .toEqual({ fallbackUsed: true, stopped: true })
  })

  it('clears pending audio timers on table and track changes', () => {
    const cleared = []
    for (const [previousTimer, changedContext] of [[73, 'mesa-b'], [91, 'track:other']]) {
      expect(changedContext).toBeTruthy()
      const timerRef = { current: previousTimer }
      clearMusicTimer(timerRef, (timer) => cleared.push(timer))
      expect(timerRef.current).toBeNull()
    }
    expect(cleared).toEqual([73, 91])
  })

  it('ignores asynchronous results from an obsolete table or identity context', () => {
    const oldContext = {
      mesaId: 'mesa-a', identityId: 'dm-a', token: 'token',
      identitySource: 'discord-auth', embedded: true, generation: 1,
    }
    const newContext = { ...oldContext, mesaId: 'mesa-b', generation: 2 }
    expect(sameSceneContext(oldContext, newContext)).toBe(false)
    expect(sameSceneContext(oldContext, { ...oldContext })).toBe(true)
    expect(sameSceneContext(oldContext, { ...oldContext, identitySource: 'participant' })).toBe(false)
  })
})

describe('scene music selections', () => {
  it('allows automatic and off selections, and a concrete manifest track only', () => {
    expect(validMusicSelection({ mode: 'auto', trackId: null }, trackIds)).toBe(true)
    expect(validMusicSelection({ mode: 'off', trackId: null }, trackIds)).toBe(true)
    expect(validMusicSelection({ mode: 'track', trackId: trackIds[0] }, trackIds)).toBe(true)
    expect(validMusicSelection({ mode: 'track', trackId: 'https://example.test/music.mp3' }, trackIds)).toBe(false)
    expect(validMusicSelection({ mode: 'track', trackId: 'not-in-manifest.mp3' }, trackIds)).toBe(false)
    expect(SCENE_TRACK_IDS).toEqual(trackIds)
    expect(validServerMusicSelection('auto', null)).toBe(true)
    expect(validServerMusicSelection('off', null)).toBe(true)
    expect(validServerMusicSelection('track', trackIds[0])).toBe(true)
    expect(validServerMusicSelection('track', 'not-in-manifest.mp3')).toBe(false)
    expect(validServerMusicSelection('track', 'https://example.test/music.mp3')).toBe(false)
  })

  it('falls back visibly to automatic when a saved track or mode is obsolete', () => {
    expect(normalizeMusicSetting({ music_mode: 'track', track_id: trackIds[0] }, tracks))
      .toEqual({ mode: 'track', trackId: trackIds[0], stale: false, updatedBy: '', updatedAt: '' })
    expect(normalizeMusicSetting({ music_mode: 'track', track_id: 'removed.mp3' }, tracks))
      .toEqual({ mode: 'auto', trackId: null, stale: true, updatedBy: '', updatedAt: '' })
    expect(normalizeMusicSetting({ music_mode: 'unknown' }, tracks))
      .toEqual({ mode: 'auto', trackId: null, stale: true, updatedBy: '', updatedAt: '' })
    expect(normalizeMusicSetting(null, tracks)).toEqual({ mode: 'auto', trackId: null, stale: false, updatedBy: '', updatedAt: '' })
  })
})

describe('scene control policy', () => {
  const authenticated = { identitySource: 'discord-auth', embedded: true, token: 'oauth-token' }

  it('shows distinct, actionable guidance for local, participant, and missing-token identities', () => {
    const local = sceneControlAccessMessage({ identitySource: 'local', embedded: false, token: '' })
    const participant = sceneControlAccessMessage({ identitySource: 'participant', embedded: true, token: '' })
    const missingToken = sceneControlAccessMessage({ identitySource: 'discord-auth', embedded: true, token: '' })

    expect(local).toBe(SCENE_CONTROL_LOCAL_MESSAGE)
    expect(local).toContain('web de prueba')
    expect(local).toContain('Activity dentro de Discord')
    expect(local).toContain('cuenta verificada del Narrador')
    expect(participant).toBe(SCENE_CONTROL_PARTICIPANT_MESSAGE)
    expect(participant).toContain('no es una autenticación OAuth')
    expect(participant).toContain('Vuelve a autenticarte')
    expect(missingToken).toBe(SCENE_CONTROL_TOKEN_MESSAGE)
    expect(missingToken).toContain('token de Discord')
    expect(missingToken).toContain('sesión expiró')
    expect(sceneControlAccessMessage({ identitySource: 'discord-auth', embedded: true, token: '  ' }))
      .toBe(SCENE_CONTROL_TOKEN_MESSAGE)
    expect(new Set([local, participant, missingToken]).size).toBe(3)
    expect(sceneControlAccessMessage({ identitySource: 'discord-auth', embedded: true, token: 'oauth-token' })).toBe('')
    expect(SCENE_CONTROL_AUTH_MESSAGE).toContain('cuenta del Narrador')
  })

  it('classifies DM claim and Discord authentication errors as non-retryable', () => {
    const dmRequired = sceneControlErrorDetails({ ...authenticated, errorCode: 'dm_required' })
    expect(dmRequired).toEqual({ message: SCENE_CONTROL_DM_MESSAGE, retryable: false })
    expect(dmRequired.message).toContain('reclama/vincula el miembro Narrador')
    expect(dmRequired.message).toContain('ID local')

    for (const errorCode of ['discord_auth_required', 'discord_verification_failed']) {
      const authError = sceneControlErrorDetails({ ...authenticated, errorCode, status: 401 })
      expect(authError).toEqual({ message: SCENE_CONTROL_DISCORD_AUTH_MESSAGE, retryable: false })
      expect(authError.message).toContain('reautentícate')
    }
  })

  it('marks only transient network, unavailable, 5xx, or database failures as retryable', () => {
    expect(sceneControlErrorDetails({ ...authenticated, networkError: true }).retryable).toBe(true)
    expect(sceneControlErrorDetails({ ...authenticated, errorCode: 'service_unavailable' }).retryable).toBe(true)
    expect(sceneControlErrorDetails({ ...authenticated, errorCode: 'scene_service_unavailable' }).retryable).toBe(true)
    expect(sceneControlErrorDetails({ ...authenticated, errorCode: 'backend_failure' }).retryable).toBe(true)
    expect(sceneControlErrorDetails({ ...authenticated, errorCode: 'database_error' }).retryable).toBe(true)
    expect(sceneControlErrorDetails({ ...authenticated, status: 503 }).retryable).toBe(true)
    expect(sceneControlErrorDetails({ ...authenticated, status: 429 }).retryable).toBe(true)
    expect(sceneControlErrorDetails({ ...authenticated, errorCode: 'unknown_error', status: 500 }).retryable).toBe(true)

    for (const input of [
      { errorCode: 'dm_required' },
      { errorCode: 'discord_auth_required' },
      { errorCode: 'invalid_request', status: 400 },
      { errorCode: 'invalid_target', status: 403 },
      { errorCode: 'unknown_error', status: 400 },
    ]) {
      expect(sceneControlErrorDetails({ ...authenticated, ...input }).retryable).toBe(false)
    }
    expect(sceneControlErrorDetails({ ...authenticated, errorCode: 'invalid_request' }).message)
      .toBe(SCENE_CONTROL_REJECTED_MESSAGE)
    expect(sceneControlErrorDetails({ ...authenticated, errorCode: 'database_error' }).message)
      .toBe(SCENE_CONTROL_RETRY_MESSAGE)
  })

  it('recognizes a direct DM or a DM resolved through a legacy identity link', () => {
    expect(resolveDmActor({ discordUserId: 'discord-dm', mesaId, directMember: { player_id: 'discord-dm', role: 'dm' } }))
      .toEqual({ authorized: true, playerId: 'discord-dm', via: 'direct' })
    expect(resolveDmActor({
      discordUserId: 'discord-dm',
      mesaId,
      legacyLink: { mesa_id: mesaId, player_id: 'local-old-dm' },
      linkedMember: { player_id: 'local-old-dm', role: 'dm' },
    })).toEqual({ authorized: true, playerId: 'local-old-dm', via: 'legacy' })
    expect(resolveDmActor({ discordUserId: 'discord-player', mesaId, directMember: { role: 'player' } }).authorized)
      .toBe(false)
    expect(resolveDmActor({ discordUserId: 'discord-visitor', mesaId, directMember: { role: 'visitor' } }).authorized)
      .toBe(false)
    expect(resolveDmActor({
      discordUserId: 'discord-player',
      mesaId,
      legacyLink: { mesa_id: mesaId, player_id: 'local-player' },
      linkedMember: { role: 'player' },
    }).authorized).toBe(false)
  })

  it('allows only the three scene conditions and denies non-DM, visitor targets, and mesa mismatch', () => {
    const base = { mesaId, requestedMesaId: mesaId, actorRole: 'dm', targetMesaId: mesaId, targetRole: 'player', conditionKey: 'frenzy' }
    expect(canControlScene({ ...base, actorRole: 'player' })).toBe(false)
    expect(canControlScene({ ...base, actorRole: 'visitor' })).toBe(false)
    expect(canControlScene({ ...base, targetRole: 'visitor' })).toBe(false)
    expect(canControlScene({ ...base, targetMesaId: 'other-mesa' })).toBe(false)
    expect(canControlScene({ ...base, requestedMesaId: 'other-mesa' })).toBe(false)
    for (const key of ['frenzy', 'knockdown', 'stunned']) {
      expect(canControlScene({ ...base, conditionKey: key })).toBe(true)
    }
    for (const key of ['health', 'incapacitated', 'unconscious', '', null]) {
      expect(canControlScene({ ...base, conditionKey: key })).toBe(false)
    }
    expect(SCENE_CONDITION_KEYS).toEqual(['frenzy', 'knockdown', 'stunned'])
    expect(SERVER_SCENE_CONDITION_KEYS).toEqual(SCENE_CONDITION_KEYS)
  })
})

describe('player-scoped frenzy state', () => {
  const conditionRows = [
    { mesa_id: mesaId, player_id: 'character-a', key: 'frenzy', active: true },
    { mesa_id: mesaId, player_id: 'character-b', key: 'frenzy', active: false },
  ]

  it('reads and writes frenzy for the selected character only', () => {
    expect(frenzyForPlayer(conditionRows, mesaId, 'character-a')).toBe(true)
    expect(frenzyForPlayer(conditionRows, mesaId, 'character-b')).toBe(false)
    expect(buildFrenzyUpdate(mesaId, 'character-b', true)).toEqual({
      mesa_id: mesaId, player_id: 'character-b', key: 'frenzy', active: true,
    })
  })

  it('does not change individual mute state', () => {
    const member = { player_id: 'character-a', muted: true }
    const update = buildFrenzyUpdate(mesaId, member.player_id, false)
    expect(update).not.toHaveProperty('muted')
    expect(member.muted).toBe(true)
  })

  it('derives confirmed Frenzy ids by exact player id, never by name or seat', () => {
    const conditions = [
      { mesa_id: mesaId, player_id: 'member-1', player_name: 'Same name', key: 'frenzy', active: true },
      { mesa_id: mesaId, player_id: 'member-2', player_name: 'Other', key: 'frenzy', active: false },
      { mesa_id: mesaId, player_id: 'member-3', player_name: 'Same name', key: 'health', active: true },
    ]
    expect([...getFrenzyPlayerIds(conditions, { mesaId, ready: true, error: '' })]).toEqual(['member-1'])
    expect(getFrenzyPlayerIds(conditions, { mesaId, ready: true, error: '' }).has('Same name')).toBe(false)
    expect(getFrenzyPlayerIds(conditions, { mesaId, ready: true, error: '' }).has('member-10')).toBe(false)
  })

  it('clears all Frenzy ids until the scene state is confirmed and after an error', () => {
    const active = [{ mesa_id: mesaId, player_id: 'member-1', key: 'frenzy', active: true }]
    expect(getFrenzyPlayerIds(active, { mesaId, ready: false, error: '' }).size).toBe(0)
    expect(getFrenzyPlayerIds(active, { mesaId, ready: true, error: 'load failed' }).size).toBe(0)
  })
})

describe('player-scoped manual scene conditions', () => {
  const conditionRows = [
    { mesa_id: mesaId, player_id: 'character-a', key: 'frenzy', active: true, updated_by: 'dm', updated_at: '2026-01-01' },
    { mesa_id: mesaId, player_id: 'character-a', key: 'knockdown', active: true, updated_by: 'dm', updated_at: '2026-01-02' },
    { mesa_id: mesaId, player_id: 'character-a', key: 'stunned', active: false, updated_by: 'dm', updated_at: '2026-01-03' },
    { mesa_id: mesaId, player_id: 'character-b', key: 'knockdown', active: false },
    { mesa_id: 'other-mesa', player_id: 'character-a', key: 'stunned', active: true },
  ]

  it('supports multiple simultaneous keys independently for the same member', () => {
    expect(sceneConditionForPlayerIsActive(conditionRows, mesaId, 'character-a', 'frenzy')).toBe(true)
    expect(sceneConditionForPlayerIsActive(conditionRows, mesaId, 'character-a', 'knockdown')).toBe(true)
    expect(sceneConditionForPlayerIsActive(conditionRows, mesaId, 'character-a', 'stunned')).toBe(false)
    expect(sceneConditionForPlayer(conditionRows, mesaId, 'character-a', 'knockdown')).toMatchObject({
      key: 'knockdown', active: true, updated_by: 'dm', updated_at: '2026-01-02',
    })
  })

  it('isolates state by both mesa and player ids, not names or seat positions', () => {
    expect(sceneConditionForPlayerIsActive(conditionRows, mesaId, 'character-a', 'stunned')).toBe(false)
    expect(sceneConditionForPlayerIsActive(conditionRows, 'other-mesa', 'character-a', 'stunned')).toBe(true)
    expect(sceneConditionForPlayer(conditionRows, mesaId, 'character-b', 'knockdown')?.active).toBe(false)
    const activeKnockdowns = getSceneConditionPlayerIds(conditionRows, 'knockdown', { mesaId, ready: true })
    expect([...activeKnockdowns]).toEqual(['character-a'])
    expect(activeKnockdowns.has('Same name')).toBe(false)
  })

  it('builds only the scoped persistence tuple and does not encode game mechanics', () => {
    expect(buildSceneConditionUpdate(mesaId, 'character-a', 'stunned', true)).toEqual({
      mesa_id: mesaId, player_id: 'character-a', key: 'stunned', active: true,
    })
    expect(buildSceneConditionUpdate(mesaId, 'character-a', 'knockdown', false)).toEqual({
      mesa_id: mesaId, player_id: 'character-a', key: 'knockdown', active: false,
    })
    expect(buildSceneConditionUpdate(mesaId, 'character-a', 'health', true)).toBeNull()
    expect(buildSceneConditionUpdate(mesaId, '', 'stunned', true)).toBeNull()
    expect(buildSceneConditionUpdate(mesaId, 'character-a', 'stunned', true)).not.toHaveProperty('dice')
    expect(buildSceneConditionUpdate(mesaId, 'character-a', 'stunned', true)).not.toHaveProperty('actions')
    expect(SCENE_CONDITION_LABELS).toEqual({
      frenzy: 'Frenesí / La Bestia', knockdown: 'Derribado/a', stunned: 'Aturdido/a',
    })
  })

  it('keeps legacy Frenzy true and false rows intact and derives no markers while loading or errored', () => {
    const legacyRows = [
      { mesa_id: mesaId, player_id: 'legacy-active', key: 'frenzy', active: true },
      { mesa_id: mesaId, player_id: 'legacy-inactive', key: 'frenzy', active: false },
    ]
    expect(frenzyForPlayer(legacyRows, mesaId, 'legacy-active')).toBe(true)
    expect(frenzyForPlayer(legacyRows, mesaId, 'legacy-inactive')).toBe(false)
    expect(buildFrenzyUpdate(mesaId, 'legacy-active', false)).toEqual({
      mesa_id: mesaId, player_id: 'legacy-active', key: 'frenzy', active: false,
    })
    for (const key of SCENE_CONDITION_KEYS) {
      expect(getSceneConditionPlayerIds(conditionRows, key, { mesaId, ready: false }).size).toBe(0)
      expect(getSceneConditionPlayerIds(conditionRows, key, { mesaId, ready: true, error: 'load failed' }).size).toBe(0)
    }
    expect(getSceneConditionPlayerIds(conditionRows, 'health', { mesaId, ready: true }).size).toBe(0)
  })
})
