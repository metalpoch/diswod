export function bindMesaToPlayer(mesa, playerId, contextGeneration = 0, effectivePlayerId = playerId) {
  if (!mesa?.id || !playerId) return null
  return { mesa, mesaId: mesa.id, playerId, effectivePlayerId, contextGeneration }
}

export function mesaForPlayer(binding, playerId, enabled = true, contextGeneration = 0) {
  if (!enabled || !playerId || !binding || binding.playerId !== playerId) return null
  if (binding.contextGeneration !== contextGeneration) return null
  if (!binding.mesa || binding.mesa.id !== binding.mesaId) return null
  return binding.mesa
}

export function mesaRequestIsCurrent(request, currentPlayerId, currentGeneration, currentContextGeneration) {
  return Boolean(
    request?.playerId
    && request.playerId === currentPlayerId
    && request.generation === currentGeneration
    && (request.contextGeneration === undefined
      || request.contextGeneration === currentContextGeneration),
  )
}
