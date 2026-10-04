import { describe, expect, it } from 'vitest'
import manifest from '../../public/audio/manifest.json'
import {
  buildFrenzyUpdate,
  canAutoplayMusic,
  clearMusicTimer,
  frenzyForPlayer,
  musicErrorTransition,
  normalizeMusicSetting,
  normalizeTrackList,
  sameSceneContext,
  validMusicSelection,
} from './scene'
import { SCENE_TRACK_IDS, validServerMusicSelection } from '../../supabase/functions/_shared/scenePolicy'
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
    const oldContext = { mesaId: 'mesa-a', identityId: 'dm-a', token: 'token', isDm: true, generation: 1 }
    const newContext = { ...oldContext, mesaId: 'mesa-b', generation: 2 }
    expect(sameSceneContext(oldContext, newContext)).toBe(false)
    expect(sameSceneContext(oldContext, { ...oldContext })).toBe(true)
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

  it('denies non-DM, visitor targets, and target/table mismatch', () => {
    const base = { mesaId, requestedMesaId: mesaId, actorRole: 'dm', targetMesaId: mesaId, targetRole: 'player', conditionKey: 'frenzy' }
    expect(canControlScene({ ...base, actorRole: 'player' })).toBe(false)
    expect(canControlScene({ ...base, targetRole: 'visitor' })).toBe(false)
    expect(canControlScene({ ...base, targetMesaId: 'other-mesa' })).toBe(false)
    expect(canControlScene({ ...base, requestedMesaId: 'other-mesa' })).toBe(false)
    expect(canControlScene({ ...base, conditionKey: 'health' })).toBe(false)
    expect(canControlScene(base)).toBe(true)
  })
})

describe('player-scoped frenzy state', () => {
  const conditionRows = [
    { mesa_id: mesaId, player_id: 'character-a', key: 'frenzy', active: true },
    { mesa_id: mesaId, player_id: 'character-b', key: 'frenzy', active: false },
  ]

  it('reads and writes frenzy for the selected character only', () => {
    expect(frenzyForPlayer(conditionRows, 'character-a')).toBe(true)
    expect(frenzyForPlayer(conditionRows, 'character-b')).toBe(false)
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
})
