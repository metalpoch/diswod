const COMMAND_RE = /^\/(r|roll)\s+(\S+)(?:\s+(.*))?$/i
const GENERIC_RE = /^(\d+)d(\d+)([+-]\d+)$/i
const WOD_RE = /^(\d+)d(\d+)$/i

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
    if (/^\/(r|roll)$/i.test(input)) {
      return { ok: false, error: 'Falta la expresión de dados' }
    }
    return { ok: false, error: 'Formato incorrecto. Ej: /r 3d5 o /r 1d10+4' }
  }

  const expr = cmd[2]
  const description = cmd[3] ? cmd[3].trim() : ''

  const generic = expr.match(GENERIC_RE)
  if (generic) {
    const count = Number(generic[1])
    const sides = Number(generic[2])
    const modifier = Number(generic[3])
    if (count < 1) return { ok: false, error: 'Debes lanzar al menos 1 dado' }
    if (count > 100) return { ok: false, error: 'Máximo 100 dados' }
    if (sides < 2) return { ok: false, error: 'El dado debe tener al menos 2 caras' }
    if (sides > 1000) return { ok: false, error: 'Máximo 1000 caras' }
    return {
      ok: true,
      type: 'generic',
      count,
      sides,
      modifier,
      description,
      command: `/r ${count}d${sides}${modifier >= 0 ? '+' : ''}${modifier}${description ? ` ${description}` : ''}`,
    }
  }

  const wod = expr.match(WOD_RE)
  if (wod) {
    const count = Number(wod[1])
    const difficulty = Number(wod[2])
    if (count < 1) return { ok: false, error: 'Debes lanzar al menos 1 dado' }
    if (count > 50) return { ok: false, error: 'Máximo 50 dados WOD' }
    if (difficulty > 10) {
      return { ok: false, error: 'Dificultad máxima: 10. Para dados genéricos usa /r 1d20+0' }
    }
    if (difficulty < 2) {
      return { ok: false, error: 'La dificultad mínima es 2' }
    }
    return {
      ok: true,
      type: 'wod',
      count,
      difficulty,
      description,
      command: `/r ${count}d${difficulty}${description ? ` ${description}` : ''}`,
    }
  }

  return { ok: false, error: 'Formato incorrecto. Ej: /r 3d5 o /r 1d10+4' }
}

export function previewCommand(parsed) {
  if (!parsed?.ok) return parsed?.error || ''
  if (parsed.type === 'wod') {
    const desc = parsed.description ? ` · ${parsed.description}` : ''
    return `WOD · ${parsed.count}d10 vs ${parsed.difficulty}${desc}`
  }
  const sign = parsed.modifier >= 0 ? `+${parsed.modifier}` : `${parsed.modifier}`
  const desc = parsed.description ? ` · ${parsed.description}` : ''
  return `Genérico · ${parsed.count}d${parsed.sides}${sign}${desc}`
}
