export const ATRIBUTOS = {
  fisicos: ['Fuerza', 'Destreza', 'Resistencia'],
  sociales: ['Carisma', 'Manipulación', 'Apariencia'],
  mentales: ['Percepción', 'Inteligencia', 'Astucia'],
}

export const HABILIDADES = {
  talentos: ['Alerta', 'Atletismo', 'Callejeo', 'Consciencia', 'Empatía', 'Expresión', 'Intimidación', 'Liderazgo', 'Pelea', 'Subterfugio'],
  tecnicas: ['Armas de Fuego', 'Artesanía', 'Conducir', 'Etiqueta', 'Interpretación', 'Latrocinio', 'Pelea con Armas', 'Sigilo', 'Supervivencia', 'T.c. Animales'],
  conocimientos: ['Academicismo', 'Ciencias', 'Finanzas', 'Informática', 'Investigación', 'Leyes', 'Medicina', 'Ocultismo', 'Política', 'Tecnología'],
}

export const VIRTUDES = ['Conciencia', 'Autocontrol', 'Coraje']

export const HEALTH_LEVELS = ['Magullado', 'Lastimado', 'Lesionado', 'Herido', 'Malherido', 'Tullido', 'Incapacitado']

export const HEALTH_PENALTIES = ['-0', '-1', '-1', '-2', '-2', '-5', '—']

export const DISCIPLINA_COUNT = 6
export const TRASFONDO_COUNT = 6
export const MERITO_COUNT = 5
export const DEFECTO_COUNT = 5

export const POINT_BUDGET = 'Atributos: 7/5/3 · Habilidades: 13/9/5 · Disciplinas: 3 · Trasfondos: 5 · Virtudes: 7 · Puntos Gratuitos: 15'

function statMap(keys) {
  return Object.fromEntries(keys.map((key) => [key, { v: 0, spec: '' }]))
}

function namedList(count) {
  return Array.from({ length: count }, () => ({ name: '', level: 0 }))
}

function costList(count) {
  return Array.from({ length: count }, () => ({ name: '', cost: 0 }))
}

export function defaultSheet() {
  return {
    header: {
      nombre: '',
      jugador: '',
      cronica: '',
      naturaleza: '',
      conducta: '',
      concepto: '',
      clan: '',
      generacion: '',
      sire: '',
      porte: 'Resolución',
      gradoPorte: '',
    },
    atributos: {
      fisicos: statMap(ATRIBUTOS.fisicos),
      sociales: statMap(ATRIBUTOS.sociales),
      mentales: statMap(ATRIBUTOS.mentales),
    },
    habilidades: {
      talentos: statMap(HABILIDADES.talentos),
      tecnicas: statMap(HABILIDADES.tecnicas),
      conocimientos: statMap(HABILIDADES.conocimientos),
    },
    virtudes: {
      conciencia: 0,
      autocontrol: 0,
      coraje: 0,
      concienciaNombre: 'Conciencia',
      autocontrolNombre: 'Autocontrol',
    },
    senda: { nombre: 'Humanidad', nivel: 0, debilidad: '' },
    disciplinas: namedList(DISCIPLINA_COUNT),
    trasfondos: namedList(TRASFONDO_COUNT),
    meritos: costList(MERITO_COUNT),
    defectos: costList(DEFECTO_COUNT),
    fuerzaVoluntad: { max: 5, actual: 5 },
    sangre: { max: 10, actual: 10, porTurno: 1 },
    salud: HEALTH_LEVELS.map(() => 0),
    experiencia: { total: 0, gastada: 0 },
  }
}

function toStat(value) {
  if (value && typeof value === 'object') {
    return {
      v: Number.isFinite(Number(value.v)) ? Math.max(0, Math.min(10, Number(value.v))) : 0,
      spec: String(value.spec || ''),
    }
  }
  if (Number.isFinite(Number(value))) {
    return { v: Math.max(0, Math.min(10, Number(value))), spec: '' }
  }
  return { v: 0, spec: '' }
}

function mergeStatGroup(base, raw, keys) {
  const out = {}
  for (const key of keys) {
    out[key] = toStat(raw?.[key] ?? base[key])
  }
  return out
}

function mergeStatGroups(base, raw, groups) {
  const out = {}
  for (const group of Object.keys(groups)) {
    out[group] = mergeStatGroup(base[group], raw?.[group], groups[group])
  }
  return out
}

function normalizeNamedList(raw, count) {
  const list = Array.isArray(raw) ? raw : []
  return Array.from({ length: count }, (_, i) => {
    const item = list[i] || {}
    return {
      name: String(item.name || '').slice(0, 40),
      level: Number.isFinite(Number(item.level)) ? Math.max(0, Math.min(5, Number(item.level))) : 0,
    }
  })
}

function normalizeCostList(raw, count) {
  const list = Array.isArray(raw) ? raw : []
  return Array.from({ length: count }, (_, i) => {
    const item = list[i] || {}
    return {
      name: String(item.name || '').slice(0, 40),
      cost: Number.isFinite(Number(item.cost)) ? Number(item.cost) : 0,
    }
  })
}

export function normalizeSheet(raw) {
  const base = defaultSheet()
  if (!raw || typeof raw !== 'object') return base

  const virtudes = raw.virtudes || {}
  const senda = raw.senda || {}
  const fv = raw.fuerzaVoluntad || {}
  const sangre = raw.sangre || {}
  const xp = raw.experiencia || {}

  return {
    ...base,
    ...raw,
    header: {
      ...base.header,
      ...(raw.header || {}),
    },
    atributos: mergeStatGroups(base.atributos, raw.atributos, ATRIBUTOS),
    habilidades: mergeStatGroups(base.habilidades, raw.habilidades, HABILIDADES),
    virtudes: {
      conciencia: Number.isFinite(Number(virtudes.conciencia)) ? Number(virtudes.conciencia) : 0,
      autocontrol: Number.isFinite(Number(virtudes.autocontrol)) ? Number(virtudes.autocontrol) : 0,
      coraje: Number.isFinite(Number(virtudes.coraje)) ? Number(virtudes.coraje) : 0,
      concienciaNombre: String(virtudes.concienciaNombre || 'Conciencia'),
      autocontrolNombre: String(virtudes.autocontrolNombre || 'Autocontrol'),
    },
    senda: {
      nombre: String(senda.nombre || 'Humanidad').slice(0, 40),
      nivel: Number.isFinite(Number(senda.nivel)) ? Math.max(0, Math.min(10, Number(senda.nivel))) : 0,
      debilidad: String(senda.debilidad || ''),
    },
    disciplinas: normalizeNamedList(raw.disciplinas, DISCIPLINA_COUNT),
    trasfondos: normalizeNamedList(raw.trasfondos, TRASFONDO_COUNT),
    meritos: normalizeCostList(raw.meritos, MERITO_COUNT),
    defectos: normalizeCostList(raw.defectos, DEFECTO_COUNT),
    fuerzaVoluntad: {
      max: Number.isFinite(Number(fv.max)) ? Number(fv.max) : base.fuerzaVoluntad.max,
      actual: Number.isFinite(Number(fv.actual)) ? Number(fv.actual) : base.fuerzaVoluntad.actual,
    },
    sangre: {
      max: Number.isFinite(Number(sangre.max)) ? Number(sangre.max) : base.sangre.max,
      actual: Number.isFinite(Number(sangre.actual)) ? Number(sangre.actual) : base.sangre.actual,
      porTurno: Number.isFinite(Number(sangre.porTurno)) ? Number(sangre.porTurno) : base.sangre.porTurno,
    },
    salud: Array.isArray(raw.salud) && raw.salud.length === HEALTH_LEVELS.length
      ? raw.salud.map((n) => Math.max(0, Math.min(3, Number(n) || 0)))
      : base.salud,
    experiencia: {
      total: Number.isFinite(Number(xp.total)) ? Number(xp.total) : 0,
      gastada: Number.isFinite(Number(xp.gastada)) ? Number(xp.gastada) : 0,
    },
  }
}
