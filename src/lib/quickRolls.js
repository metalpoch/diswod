import { DISCIPLINAS } from './sheetOptions'

const validDisciplineNames = new Map(DISCIPLINAS.map((name) => [name.toLocaleLowerCase(), name]))

function numeric(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function statValue(value) {
  return Math.trunc(numeric(value && typeof value === 'object' ? value.v : value))
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, numeric(value)))
}

export function createQuickRollOrigin({ mesaId = '', playerId = '', text = '' } = {}) {
  return { mesaId: String(mesaId || ''), playerId: String(playerId || ''), text: String(text) }
}

export function quickRollOriginMatches(origin, target, text) {
  return Boolean(origin)
    && target?.ready !== false
    && origin.mesaId === String(target?.mesaId || '')
    && origin.playerId === String(target?.playerId || '')
    && origin.text === String(text ?? '')
}

export function reconcileQuickRollOrigin(origin, target, text) {
  const currentText = String(text ?? '')
  if (!origin || quickRollOriginMatches(origin, target, currentText)) {
    return { text: currentText, origin: origin || null, invalidated: false }
  }

  return {
    text: currentText === origin.text ? '' : currentText,
    origin: null,
    invalidated: true,
  }
}

export function getOwnedDisciplines(sheet) {
  if (!Array.isArray(sheet?.disciplinas)) return []
  return sheet.disciplinas.flatMap((item, index) => {
    const name = String(item?.name || '').trim()
    const canonicalName = validDisciplineNames.get(name.toLocaleLowerCase())
    const level = numeric(item?.level)
    return canonicalName && level > 0 ? [{ name: canonicalName, level, index }] : []
  })
}

export function getInitiativeBreakdown(sheet, { woundPenalty = 0, unspentCelerity = 0 } = {}) {
  const dexterity = statValue(sheet?.atributos?.fisicos?.Destreza)
  const wits = statValue(sheet?.atributos?.mentales?.Astucia)
  const celerity = getOwnedDisciplines(sheet).find((discipline) => discipline.name === 'Celeridad')
  const celerityLevel = celerity?.level || 0
  const wounds = Math.trunc(clamp(woundPenalty, 0, 5))
  const extraCelerity = Math.trunc(clamp(unspentCelerity, 0, celerityLevel))
  const modifier = dexterity + wits - wounds + extraCelerity

  return {
    dexterity,
    wits,
    woundPenalty: wounds,
    celerityLevel,
    unspentCelerity: extraCelerity,
    modifier,
  }
}

function signedModifier(modifier) {
  const value = numeric(modifier)
  return value < 0 ? String(value) : `+${value}`
}

export function buildInitiativeCommand(sheet, options = {}) {
  const breakdown = getInitiativeBreakdown(sheet, options)
  const characterName = String(options.targetName || sheet?.header?.nombre || 'Personaje').trim() || 'Personaje'
  const identityNote = options.isOwn === false ? ' · usando otra ficha; tirada registrada con la identidad de quien lanza' : ''
  const description = `Iniciativa · ${characterName}${identityNote}`
  return {
    ...breakdown,
    command: `/r 1d10${signedModifier(breakdown.modifier)} ${description}`,
    preview: `1d10 + Destreza ${breakdown.dexterity} + Astucia ${breakdown.wits} − heridas ${breakdown.woundPenalty} + Celeridad ${breakdown.unspentCelerity} = 1d10${signedModifier(breakdown.modifier)}`,
  }
}

export function buildDisciplineCommand({ count, difficulty, discipline, power = '', targetName = '' } = {}) {
  const pool = Math.trunc(clamp(count, 1, 50))
  const targetDifficulty = Math.trunc(clamp(difficulty, 2, 10))
  const disciplineName = validDisciplineNames.get(String(discipline || '').trim().toLocaleLowerCase())
  if (!disciplineName) return ''
  const powerName = String(power || '').trim()
  const target = String(targetName || '').trim()
  const description = [disciplineName, powerName, target].filter(Boolean).join(' · ')
  return `/r ${pool}wod${targetDifficulty} ${description}`
}
