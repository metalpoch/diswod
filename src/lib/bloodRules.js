const GENERATION_LIMITS = {
  4: { max: 50, perTurn: 10 },
  5: { max: 40, perTurn: 8 },
  6: { max: 30, perTurn: 6 },
  7: { max: 20, perTurn: 4 },
  8: { max: 15, perTurn: 3 },
  9: { max: 14, perTurn: 2 },
  10: { max: 13, perTurn: 1 },
  11: { max: 12, perTurn: 1 },
  12: { max: 11, perTurn: 1 },
  13: { max: 10, perTurn: 1 },
  14: { max: 10, perTurn: 1 },
  15: { max: 10, perTurn: 1 },
}

function parseGeneration(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const match = String(value).trim().match(/^(3|4|5|6|7|8|9|10|11|12|13|14|15)(?:ª|a|th)?(?:\s+generaci[oó]n)?$/i)
  return match ? Number(match[1]) : null
}

export function getBloodRules(generation) {
  const parsed = parseGeneration(generation)
  const limits = GENERATION_LIMITS[parsed]
  return limits ? { generation: parsed, ...limits } : null
}

export function getHuntingInfo(virtueName, virtueValue, currentBlood) {
  if (virtueName !== 'Autocontrol' && virtueName !== 'Instinto') return null
  if (!Number.isInteger(virtueValue) || virtueValue < 0 || virtueValue > 5) return null
  if (!Number.isInteger(currentBlood) || currentBlood < 0) return null

  const threshold = 7 - virtueValue
  return {
    virtueName,
    virtueValue,
    threshold,
    currentBlood,
    isEmpty: currentBlood === 0,
    isBelowThreshold: currentBlood < threshold,
    isAtThreshold: currentBlood === threshold,
  }
}
