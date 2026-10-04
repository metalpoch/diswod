import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('./supabase', () => ({
  supabase: { functions: { invoke } },
}))

import { authenticateDiscordUser } from './discord'

describe('Discord OAuth scopes', () => {
  beforeEach(() => {
    invoke.mockResolvedValue({ data: { access_token: 'access-token' }, error: null })
  })

  it('requests only the identify scope', async () => {
    const sdk = {
      commands: {
        authorize: vi.fn().mockResolvedValue({ code: 'oauth-code' }),
        authenticate: vi.fn().mockResolvedValue({
          user: { id: 'discord-user', username: 'Kindred' },
        }),
      },
    }

    await authenticateDiscordUser(sdk, 'client-id')

    expect(sdk.commands.authorize).toHaveBeenCalledWith({
      client_id: 'client-id',
      response_type: 'code',
      prompt: 'none',
      scope: ['identify'],
    })
  })
})
