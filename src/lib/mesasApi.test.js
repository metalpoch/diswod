import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFrom, mockUpsert } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockUpsert: vi.fn(),
}))
vi.mock('./supabase', () => ({
  supabase: { from: mockFrom, functions: { invoke: vi.fn() } },
}))

import { joinByCode } from './mesasApi'
import { identityWithMesaClaim } from './playerIdentityLinks'

describe('joinByCode identity resolution', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockUpsert.mockReset()

    const mesaQuery = {}
    Object.assign(mesaQuery, {
      select: vi.fn(() => mesaQuery),
      eq: vi.fn(() => mesaQuery),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'mesa-a', invite_code: 'INVITE', status: 'active' },
        error: null,
      }),
    })
    const membersQuery = {}
    Object.assign(membersQuery, {
      select: vi.fn(() => membersQuery),
      eq: vi.fn(() => membersQuery),
      order: vi.fn().mockResolvedValue({
        data: [{ player_id: 'local-percival', player_name: 'Percival', role: 'player' }],
        error: null,
      }),
      single: vi.fn().mockResolvedValue({
        data: { player_id: 'discord-42', player_name: 'Discord', role: 'player' },
        error: null,
      }),
      upsert: mockUpsert,
    })
    mockFrom.mockImplementation((table) => (table === 'mesas' ? mesaQuery : membersQuery))
    mockUpsert.mockImplementation(() => membersQuery)
  })

  it('resolves the claimed legacy member without creating a direct Discord member', async () => {
    const discordIdentity = {
      id: 'discord-42',
      discordId: 'discord-42',
      source: 'discord-auth',
      links: [],
    }
    const linkedIdentity = identityWithMesaClaim(discordIdentity, 'mesa-a', 'local-percival')

    const result = await joinByCode('INVITE', linkedIdentity)

    expect(result).toMatchObject({
      mesa: { id: 'mesa-a', myPlayerId: 'local-percival' },
      member: { player_id: 'local-percival' },
      isNew: false,
    })
    expect(result.member.player_id).not.toBe(linkedIdentity.id)
    expect(mockUpsert).not.toHaveBeenCalled()
  })
})
