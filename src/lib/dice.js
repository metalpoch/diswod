export function rollDie(sides, rng = defaultRng) {
  return rng(sides)
}

const UINT32_MAX = 0xffffffff

export function defaultRng(sides) {
  const buf = new Uint32Array(1)
  const limit = UINT32_MAX - (UINT32_MAX % sides)
  let value
  do {
    crypto.getRandomValues(buf)
    value = buf[0]
  } while (value >= limit)
  return (value % sides) + 1
}

export function rollWod(count, difficulty, rng = defaultRng) {
  const dice = []
  let pending = count
  let guard = 0

  while (pending > 0 && guard < 200) {
    let exploded = 0
    for (let i = 0; i < pending; i += 1) {
      const value = rollDie(10, rng)
      const success = value >= difficulty
      const isTen = value === 10
      const isOne = value === 1
      dice.push({
        value,
        success,
        isTen,
        isOne,
        exploded: guard > 0,
      })
      if (isTen) exploded += 1
    }
    pending = exploded
    guard += 1
  }

  const rawSuccesses = dice.filter((d) => d.success).length
  const ones = dice.filter((d) => d.isOne).length
  const failures = dice.filter((d) => !d.success).length
  const successes = Math.max(0, rawSuccesses - ones)
  const botch = rawSuccesses === 0 && ones > 0

  return {
    type: 'wod',
    count,
    difficulty,
    dice,
    values: dice.map((d) => d.value),
    successes,
    rawSuccesses,
    failures,
    ones,
    botch,
  }
}

export function rollGeneric(count, sides, modifier, rng = defaultRng) {
  const dice = Array.from({ length: count }, () => rollDie(sides, rng))
  const sum = dice.reduce((acc, n) => acc + n, 0)
  return {
    type: 'generic',
    count,
    sides,
    modifier,
    dice,
    sum,
    total: sum + modifier,
  }
}

export function executeParsed(parsed, rng = defaultRng) {
  if (!parsed?.ok) return null
  if (parsed.type === 'wod') {
    return {
      ...rollWod(parsed.count, parsed.difficulty, rng),
      description: parsed.description,
      command: parsed.command,
    }
  }
  return {
    ...rollGeneric(parsed.count, parsed.sides, parsed.modifier, rng),
    description: parsed.description,
    command: parsed.command,
  }
}

export function formatWodLine(result) {
  const label = result.description || 'Roll'
  const n = result.successes
  const f = result.failures
  const prefix = result.botch ? 'BOTCH — ' : ''
  return `${label}: [${result.values.join(', ')}] = ${prefix}${n} successes (${f} failures)`
}

export function formatGenericLine(result) {
  const label = result.description || 'Resultado'
  const dicePart = result.dice.length === 1 ? String(result.dice[0]) : `[${result.dice.join(', ')}]`
  return `${label}: ${result.total} (Dados: ${dicePart} + Mod: ${result.modifier})`
}

export function formatResultLine(result) {
  if (result.type === 'wod') return formatWodLine(result)
  return formatGenericLine(result)
}

export function formatHistoryText(entries) {
  return entries
    .map((entry) => {
      const time = formatTime(entry.ts)
      const name = entry.player?.name || 'Desconocido'
      return `[${time}] ${name} ${entry.command}\n${entry.line}`
    })
    .join('\n\n')
}

export function formatTime(ts) {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}
