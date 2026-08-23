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

export function rollWod(count, difficulty, specialty = false, rng = defaultRng) {
  const dice = []
  for (let i = 0; i < count; i += 1) {
    const value = rollDie(10, rng)
    const isTen = value === 10
    const isOne = value === 1
    const success = value >= difficulty
    dice.push({ value, success, isTen, isOne })
  }

  const rawSuccesses = dice.reduce(
    (acc, d) => acc + (d.isTen && specialty ? 2 : d.success ? 1 : 0),
    0,
  )
  const ones = dice.filter((d) => d.isOne).length
  const failures = dice.filter((d) => !d.success).length
  const successes = Math.max(0, rawSuccesses - ones)
  const botch = rawSuccesses === 0 && ones > 0

  return {
    type: 'wod',
    count,
    difficulty,
    specialty,
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

export function rollMulti(pools, rng = defaultRng) {
  const rolled = pools.map((pool) => (pool.type === 'wod'
    ? rollWod(pool.count, pool.difficulty, pool.specialty, rng)
    : rollGeneric(pool.count, pool.sides, pool.modifier, rng)))
  const allWod = rolled.every((r) => r.type === 'wod')
  const allGeneric = rolled.every((r) => r.type === 'generic')
  const out = { type: 'multi', pools: rolled }
  if (allWod) {
    out.successes = rolled.reduce((acc, r) => acc + r.successes, 0)
    out.rawSuccesses = rolled.reduce((acc, r) => acc + r.rawSuccesses, 0)
    out.failures = rolled.reduce((acc, r) => acc + r.failures, 0)
    out.ones = rolled.reduce((acc, r) => acc + r.ones, 0)
    out.botch = out.rawSuccesses === 0 && out.ones > 0
  } else if (allGeneric) {
    out.total = rolled.reduce((acc, r) => acc + r.total, 0)
  }
  return out
}

export function executeParsed(parsed, rng = defaultRng) {
  if (!parsed?.ok) return null
  if (parsed.type === 'multi') {
    return {
      ...rollMulti(parsed.pools, rng),
      description: parsed.description,
      command: parsed.command,
    }
  }
  if (parsed.type === 'wod') {
    return {
      ...rollWod(parsed.count, parsed.difficulty, parsed.specialty, rng),
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

export function formatMultiLine(result) {
  const label = result.description || 'Roll'
  const parts = result.pools.map((pool) => (pool.type === 'wod'
    ? `[${pool.values.join(', ')}]`
    : `[${pool.dice.join(', ')}]`))
  const dicePart = parts.join(' + ')
  if (result.botch != null) {
    const prefix = result.botch ? 'BOTCH — ' : ''
    return `${label}: ${dicePart} = ${prefix}${result.successes} successes (${result.failures} failures)`
  }
  if (result.total != null) {
    return `${label}: ${dicePart} = ${result.total}`
  }
  return `${label}: ${dicePart}`
}

export function formatResultLine(result) {
  if (result.type === 'wod') return formatWodLine(result)
  if (result.type === 'multi') return formatMultiLine(result)
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
