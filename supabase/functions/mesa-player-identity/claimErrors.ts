export function claimRpcError(status: unknown) {
  if (status === 'dm_confirmation_required') return { error: 'dm_confirmation_required', status: 409 }
  if (status === 'conflict') return { error: 'conflict', status: 409 }
  if (status === 'invalid_invite') return { error: 'invalid_invite', status: 403 }
  return { error: 'invalid_candidate', status: 400 }
}
