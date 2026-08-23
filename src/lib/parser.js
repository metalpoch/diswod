const COMMAND_RE = /^\/(r|roll)\s+(.+)$/i
const POOL_WOD_RE = /^(\d+)wod(\d+)$/i
const POOL_GENERIC_RE = /^(\d+)d(\d+)([+-]\d+)?$/i
const EXPR_RE = /^((?:\d+wod\d+|\d+d\d+(?:[+-]\d+)?)(?:\s*\+\s*(?:\d+wod\d+|\d+d\d+(?:[+-]\d+)?))*)/i

function commandString(pools, description) {
  const expr = pools.map((p) => {
    if (p.type === 'wod') return `${p.count}wod${p.difficulty}`
    const mod = p.modifier ? (p.modifier > 0 ? '+' : '') + p.modifier : ''
    return `${p.count}d${p.sides}${mod}`
  }).join(' + ')
  return `/r ${expr}${description ? ` ${description}` : ''}`
}

export function parseCommand(raw) {
  const input = String(raw ?? '').trim()
  if (!input) {
    return { ok: false, empty: true, error: '' }
  }

  if (!/^\//.test(input)) {
    return { ok: false, error: 'El comando debe empezar por /r o /roll' }
  }

  const cmd = input.match(COMMAND_RE)
  if (!cmd) {
    return { ok: false, error: 'Formato incorrecto. Ej: /r 4wod6 o /r 3d10' }
  }

  const body = cmd[2].trim()
  const match = body.match(EXPR_RE)
  if (!match || !match[1]) {
    return { ok: false, error: 'Expresión de dados inválida. Ej: /r 4wod6, /r 3d10 o /r 4wod6 + 3wod8' }
  }
  const expr = match[1]
  const rest = body.slice(match[0].length)
  if (rest && !/^\s/.test(rest)) {
    return { ok: false, error: `Expresión inválida tras «${expr}»` }
  }
  const description = rest.trim()

  const parts = expr.split(/\s*\+\s*(?=\d+[dw])/i)
  const pools = []
  for (const part of parts) {
    const token = part.trim()
    const wod = token.match(POOL_WOD_RE)
    if (wod) {
      const count = Number(wod[1])
      const difficulty = Number(wod[2])
      if (count < 1) return { ok: false, error: 'Debes lanzar al menos 1 dado' }
      if (count > 50) return { ok: false, error: 'Máximo 50 dados WOD por reserva' }
      if (difficulty < 2 || difficulty > 10) return { ok: false, error: 'La dificultad WOD debe estar entre 2 y 10' }
      pools.push({ type: 'wod', count, difficulty })
      continue
    }
    const generic = token.match(POOL_GENERIC_RE)
    if (generic) {
      const count = Number(generic[1])
      const sides = Number(generic[2])
      const modifier = generic[3] ? Number(generic[3]) : 0
      if (count < 1) return { ok: false, error: 'Debes lanzar al menos 1 dado' }
      if (count > 100) return { ok: false, error: 'Máximo 100 dados' }
      if (sides < 2) return { ok: false, error: 'El dado debe tener al menos 2 caras' }
      if (sides > 1000) return { ok: false, error: 'Máximo 1000 caras' }
      pools.push({ type: 'generic', count, sides, modifier })
      continue
    }
    return { ok: false, error: `No entiendo «${token}»` }
  }

  if (pools.length === 0) {
    return { ok: false, error: 'Falta la expresión de dados' }
  }

  const command = commandString(pools, description)

  if (pools.length === 1) {
    const pool = pools[0]
    if (pool.type === 'wod') {
      return { ok: true, type: 'wod', count: pool.count, difficulty: pool.difficulty, description, command }
    }
    return { ok: true, type: 'generic', count: pool.count, sides: pool.sides, modifier: pool.modifier, description, command }
  }

  return { ok: true, type: 'multi', pools, description, command }
}

export function previewCommand(parsed) {
  if (!parsed?.ok) return parsed?.error || ''
  if (parsed.type === 'wod') {
    const desc = parsed.description ? ` · ${parsed.description}` : ''
    return `WOD · ${parsed.count}d10 vs ${parsed.difficulty}${desc}`
  }
  if (parsed.type === 'generic') {
    const sign = parsed.modifier >= 0 ? `+${parsed.modifier}` : `${parsed.modifier}`
    const desc = parsed.description ? ` · ${parsed.description}` : ''
    return `Genérico · ${parsed.count}d${parsed.sides}${parsed.modifier ? sign : ''}${desc}`
  }
  const pools = parsed.pools.map((p) => {
    if (p.type === 'wod') return `${p.count}wod${p.difficulty}`
    const mod = p.modifier ? (p.modifier > 0 ? '+' : '') + p.modifier : ''
    return `${p.count}d${p.sides}${mod}`
  }).join(' + ')
  const desc = parsed.description ? ` · ${parsed.description}` : ''
  return `Combinada · ${pools}${desc}`
}
