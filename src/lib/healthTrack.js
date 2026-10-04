export const HEALTH_MARKS = Object.freeze({
  1: { symbol: '/', name: 'Contundente' },
  2: { symbol: 'X', name: 'Letal' },
  3: { symbol: '*', name: 'Agravado' },
})

const PENALTIES = [0, 1, 1, 2, 2, 5, null]

export function isValidHealth(health) {
  return Array.isArray(health)
    && health.length === 7
    && Array.from(health).every((mark) => Number.isInteger(mark) && mark >= 0 && mark <= 3)
}

export function healthCounts(health) {
  if (!isValidHealth(health)) return null
  return {
    contundente: health.filter((mark) => mark === 1).length,
    letal: health.filter((mark) => mark === 2).length,
    agravado: health.filter((mark) => mark === 3).length,
  }
}

export function isCanonicalHealth(health) {
  if (!isValidHealth(health)) return false
  const ordered = health.filter(Boolean).sort((a, b) => b - a)
  return health.every((mark, index) => mark === (ordered[index] || 0))
}

export function summarizeHealth(health) {
  const valid = isValidHealth(health)
  if (!valid) {
    return {
      valid: false,
      levelIndex: -1,
      level: '',
      penalty: null,
      incapacitated: false,
      irregular: true,
      counts: null,
    }
  }

  let levelIndex = -1
  for (let index = health.length - 1; index >= 0; index -= 1) {
    if (health[index] !== 0) {
      levelIndex = index
      break
    }
  }
  const levels = ['Magullado', 'Lastimado', 'Lesionado', 'Herido', 'Malherido', 'Tullido', 'Incapacitado']
  const incapacitated = levelIndex === 6
  return {
    valid: true,
    levelIndex,
    level: levelIndex < 0 ? 'Sin heridas' : levels[levelIndex],
    penalty: levelIndex < 0 ? 0 : PENALTIES[levelIndex],
    incapacitated,
    irregular: !isCanonicalHealth(health),
    counts: healthCounts(health),
  }
}

function canonicalVector(marks) {
  return [...marks].sort((a, b) => b - a).concat(Array(7 - marks.length).fill(0))
}

function resultFor(health, nextHealth, { requiresConfirmation = false, reason = '' } = {}) {
  return {
    ok: Boolean(nextHealth),
    health: nextHealth ? [...nextHealth] : null,
    requiresConfirmation,
    reason,
    beforeCounts: healthCounts(health),
    afterCounts: nextHealth ? healthCounts(nextHealth) : null,
  }
}

export function addHealthDamage(health, mark, { confirmed = false } = {}) {
  if (!isValidHealth(health)) return resultFor(health, null, { reason: 'La pista debe tener exactamente 7 casillas con valores de 0 a 3.' })
  if (!HEALTH_MARKS[mark]) return resultFor(health, null, { reason: 'Tipo de daño no válido.' })
  if (health.every(Boolean)) return resultFor(health, null, { reason: 'Las 7 casillas están ocupadas; no se aplicó daño.' })

  const next = canonicalVector([...health.filter(Boolean), mark])
  if (!isCanonicalHealth(health) && !confirmed) {
    return { ...resultFor(health, null), afterCounts: healthCounts(next), requiresConfirmation: true, preview: next }
  }
  return resultFor(health, next)
}

export function removeHealthDamage(health, mark, { confirmed = false } = {}) {
  if (!isValidHealth(health)) return resultFor(health, null, { reason: 'La pista debe tener exactamente 7 casillas con valores de 0 a 3.' })
  if (!HEALTH_MARKS[mark]) return resultFor(health, null, { reason: 'Tipo de daño no válido.' })
  const marks = [...health]
  const index = marks.indexOf(mark)
  if (index < 0) return resultFor(health, null, { reason: `No hay una marca ${HEALTH_MARKS[mark].name.toLowerCase()} que quitar.` })
  marks[index] = 0
  const next = canonicalVector(marks.filter(Boolean))
  const movesMarks = next.some((value, slot) => value !== marks[slot])
  if (movesMarks && !confirmed) {
    return { ...resultFor(health, null), afterCounts: healthCounts(next), requiresConfirmation: true, preview: next }
  }
  return resultFor(health, next)
}

export function formatHealthCounts(counts) {
  if (!counts) return 'No disponibles'
  return `contundente ${counts.contundente} · letal ${counts.letal} · agravado ${counts.agravado}`
}
