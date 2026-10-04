import { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'
import AvatarCrop from './AvatarCrop'
import {
  ATRIBUTOS,
  HABILIDADES,
  HEALTH_LEVELS,
  POINT_BUDGET,
} from '../lib/characterSheet'
import {
  ARQUETIPOS,
  CLANES,
  CONCEPTOS,
  DEFECTOS,
  DISCIPLINAS,
  ESPECIALIDADES_ATRIBUTOS,
  ESPECIALIDADES_HABILIDADES,
  GENERACIONES,
  MERITOS,
  PORTES,
  SENDAS,
  TRASFONDOS,
  VIRTUD_AUTOCONTROL,
  VIRTUD_CONCIENCIA,
} from '../lib/sheetOptions'

import {
  buildDisciplineCommand,
  buildInitiativeCommand,
  getInitiativeBreakdown,
  getOwnedDisciplines,
} from '../lib/quickRolls'
import {
  addHealthDamage,
  formatHealthCounts,
  HEALTH_MARKS,
  isValidHealth,
  removeHealthDamage,
  summarizeHealth,
} from '../lib/healthTrack'

const HEALTH_SYMBOLS = ['', '/', 'X', '*']
const HEALTH_LEVEL_PENALTIES = [0, 1, 1, 2, 2, 5, null]

function DieIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <polygon points="32,4 60,24 52,56 12,56 4,24" />
      <polyline points="32,4 32,56" />
      <polyline points="4,24 60,24" />
      <polyline points="12,56 32,24 52,56" />
    </svg>
  )
}

function Combo({ id, value, options, readOnly, onChange, placeholder }) {
  return (
    <>
      <input
        className="combo"
        list={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || ''}
        readOnly={readOnly}
      />
      <datalist id={id}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  )
}

function Dots({ value, max = 5, readOnly, onChange }) {
  return (
    <span className="stat-dots" role="group" aria-label={`${value} de ${max}`}>
      {Array.from({ length: max }, (_, i) => {
        const on = i < value
        return (
          <button
            key={i}
            type="button"
            className={on ? 'stat-dot is-on' : 'stat-dot'}
            disabled={readOnly}
            onClick={() => onChange?.(on && i === value - 1 ? 0 : i + 1)}
            aria-label={`${i + 1}`}
          />
        )
      })}
    </span>
  )
}

function StatRow({ label, value, selected, readOnly, rollDisabled, onToggle, onChange, onRoll }) {
  return (
    <div className="stat-row">
      <button
        type="button"
        className={selected ? 'stat-name is-selected' : 'stat-name'}
        onClick={onToggle}
        title={label}
        aria-label={`${selected ? 'Quitar' : 'Añadir'} ${label} ${selected ? 'de' : 'a'} la reserva combinada`}
      >
        {label}
      </button>
      <Dots value={value} readOnly={readOnly} onChange={onChange} />
      <button
        type="button"
        className="stat-roll"
        onClick={onRoll}
        disabled={rollDisabled || !value}
        title={value ? `Tirar ${value}d10` : 'Sin puntos'}
        aria-label={`Tirar ${label}, ${value} dados`}
      >
        <DieIcon />
      </button>
    </div>
  )
}

function VirtueRow({ name, nameOptions, value, selected, readOnly, rollDisabled, onName, onToggle, onValue, onRoll }) {
  return (
    <div className="stat-row virtue-row">
      <button
        type="button"
        className={selected ? 'stat-toggle is-selected' : 'stat-toggle'}
        onClick={onToggle}
        title="Añadir o quitar de la tirada combinada"
        aria-label={`${selected ? 'Quitar' : 'Añadir'} ${name} ${selected ? 'de' : 'a'} la reserva combinada`}
      >
        {selected ? '−' : '+'}
      </button>
      <select
        className="virtue-select"
        value={name}
        onChange={(e) => onName(e.target.value)}
        disabled={readOnly}
      >
        {nameOptions.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <Dots value={value} readOnly={readOnly} onChange={onValue} />
      <button
        type="button"
        className="stat-roll"
        onClick={onRoll}
        disabled={rollDisabled || !value}
        title={value ? `Tirar ${value}d10` : 'Sin puntos'}
        aria-label={`Tirar ${name}, ${value} dados`}
      >
        <DieIcon />
      </button>
    </div>
  )
}

function NamedRow({ item, index, selected, readOnly, rollDisabled, placeholder, options, onName, onLevel, onToggle, onRoll }) {
  return (
    <div className="stat-row list-row">
      <button
        type="button"
        className={selected ? 'stat-toggle is-selected' : 'stat-toggle'}
        onClick={onToggle}
        title="Añadir o quitar de la tirada combinada"
        aria-label={`${selected ? 'Quitar' : 'Añadir'} ${item.name || placeholder} ${selected ? 'de' : 'a'} la reserva combinada`}
      >
        {selected ? '−' : '+'}
      </button>
      <Combo
        id={`combo-${placeholder}-${index}`}
        value={item.name}
        options={options}
        readOnly={readOnly}
        onChange={(v) => onName(index, v)}
        placeholder={placeholder}
      />
      <Dots value={item.level} readOnly={readOnly} onChange={(v) => onLevel(index, v)} />
      <button
        type="button"
        className="stat-roll"
        onClick={onRoll}
        disabled={rollDisabled || !item.level}
        title={item.level ? `Tirar ${item.level}d10` : 'Sin nivel'}
        aria-label={`Tirar ${item.name || placeholder}, ${item.level} dados`}
      >
        <DieIcon />
      </button>
    </div>
  )
}

function CostRow({ label, item, index, options, readOnly, onName, onCost }) {
  return (
    <div className="stat-row list-row cost-row">
      <Combo
        id={`combo-${label}-${index}`}
        value={item.name}
        options={options}
        readOnly={readOnly}
        onChange={(v) => onName(index, v)}
        placeholder={label}
      />
      <input
        className="cost"
        type="number"
        value={item.cost}
        onChange={(e) => onCost(index, e.target.value === '' ? 0 : Number(e.target.value))}
        readOnly={readOnly}
        title="Coste (méritos +, defectos −)"
      />
    </div>
  )
}

function Field({ label, value, readOnly, onChange, placeholder }) {
  return (
    <label className="sheet-field">
      <span>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || ''}
        readOnly={readOnly}
      />
    </label>
  )
}

function ComboField({ label, id, value, options, readOnly, onChange }) {
  return (
    <label className="sheet-field">
      <span>{label}</span>
      <Combo id={id} value={value} options={options} readOnly={readOnly} onChange={onChange} />
    </label>
  )
}

function NumField({ label, value, readOnly, onChange, min, max }) {
  return (
    <label className="sheet-field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        readOnly={readOnly}
      />
    </label>
  )
}

function Section({ title, children, className, id }) {
  return (
    <section id={id} className={className ? `sheet-section ${className}` : 'sheet-section'}>
      <header className="sheet-section-head"><h3>{title}</h3></header>
      <div className="sheet-section-body">{children}</div>
    </section>
  )
}

export default function CharacterSheet({
  sheet,
  readOnly,
  status,
  onRetrySave,
  rollDisabled,
  onChange,
  onCompose,
  diceText,
  avatar,
  onAvatar,
  isOwn,
}) {
  const [pool, setPool] = useState([])
  const [specialty, setSpecialty] = useState(false)
  const [unspentCelerity, setUnspentCelerity] = useState(0)
  const [healthRemoveType, setHealthRemoveType] = useState('1')
  const [healthFeedback, setHealthFeedback] = useState('')
  const [pendingHealth, setPendingHealth] = useState(null)
  const [activeDiscipline, setActiveDiscipline] = useState('')
  const [disciplinePool, setDisciplinePool] = useState(1)
  const [disciplineDifficulty, setDisciplineDifficulty] = useState(6)
  const [disciplinePower, setDisciplinePower] = useState('')
  const [cropSrc, setCropSrc] = useState(null)
  const [avatarError, setAvatarError] = useState('')
  const fileRef = useRef(null)

  const statValue = (s) => (s && typeof s === 'object' ? Number(s.v) || 0 : Number(s) || 0)
  const health = summarizeHealth(sheet.salud)
  const healthEditable = !readOnly && Boolean(onChange) && status !== 'Error al guardar' && status !== 'Guardado cancelado'
  const healthArrayValid = isValidHealth(sheet.salud)
  const ownedDisciplines = getOwnedDisciplines(sheet)
  const celerityLevel = ownedDisciplines.find((discipline) => discipline.name === 'Celeridad')?.level || 0
  const initiative = getInitiativeBreakdown(sheet, { unspentCelerity })
  const selectedDiscipline = ownedDisciplines.find((discipline) => discipline.name === activeDiscipline)

  const valueOf = (id) => {
    const [kind, a, b] = id.split(':')
    if (kind === 'a') return statValue(sheet.atributos[a]?.[b])
    if (kind === 'h') return statValue(sheet.habilidades[a]?.[b])
    if (kind === 'v') return Number(sheet.virtudes[b]) || 0
    if (kind === 'd') return Number(sheet.disciplinas[Number(a)]?.level) || 0
    if (kind === 't') return Number(sheet.trasfondos[Number(a)]?.level) || 0
    return 0
  }

  const composeFromPool = (nextPool, spec) => {
    const total = nextPool.reduce((acc, p) => acc + valueOf(p.id), 0)
    if (!total) {
      onCompose?.(null)
      return
    }
    onCompose?.({ count: total, description: nextPool.map((p) => p.label).join(' + '), specialty: spec })
  }

  const togglePool = (id, label) => {
    const exists = pool.some((p) => p.id === id)
    const next = exists ? pool.filter((p) => p.id !== id) : [...pool, { id, label }]
    setPool(next)
    composeFromPool(next, specialty)
  }

  const composeOne = (label, count) => {
    if (!count) return
    setPool([])
    onCompose?.({ count, description: label, specialty })
  }

  const toggleSpecialty = (next) => {
    setSpecialty(next)
    if (pool.length) composeFromPool(pool, next)
  }

  useEffect(() => {
    if (!diceText) setPool([])
  }, [diceText])

  useEffect(() => {
    setUnspentCelerity((value) => Math.min(value, celerityLevel))
    if (activeDiscipline && !ownedDisciplines.some((discipline) => discipline.name === activeDiscipline)) {
      setActiveDiscipline('')
      setDisciplinePower('')
    }
  }, [sheet.disciplinas, celerityLevel, activeDiscipline])

  const setHeader = (key, value) => onChange?.({ ...sheet, header: { ...sheet.header, [key]: value } })
  const setAtributo = (group, key, patch) => {
    const stat = sheet.atributos[group][key]
    onChange?.({
      ...sheet,
      atributos: { ...sheet.atributos, [group]: { ...sheet.atributos[group], [key]: { ...stat, ...patch } } },
    })
  }
  const setHabilidad = (group, key, patch) => {
    const stat = sheet.habilidades[group][key]
    onChange?.({
      ...sheet,
      habilidades: { ...sheet.habilidades, [group]: { ...sheet.habilidades[group], [key]: { ...stat, ...patch } } },
    })
  }
  const setVirtud = (key, value) => onChange?.({ ...sheet, virtudes: { ...sheet.virtudes, [key]: value } })
  const setSenda = (key, value) => onChange?.({ ...sheet, senda: { ...sheet.senda, [key]: value } })
  const setNamed = (listKey, index, patch) => onChange?.({
    ...sheet,
    [listKey]: sheet[listKey].map((item, i) => (i === index ? { ...item, ...patch } : item)),
  })
  const setEstado = (key, patch) => onChange?.({ ...sheet, [key]: { ...sheet[key], ...patch } })

  const pickPhoto = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setAvatarError('')
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result)
    reader.readAsDataURL(file)
  }

  const confirmAvatar = async (avatarFile, fullFile) => {
    setCropSrc(null)
    try {
      await onAvatar?.(avatarFile, fullFile)
    } catch (err) {
      setAvatarError(err.message || 'No se pudo subir la foto')
    }
  }

  const prepareInitiative = () => {
    if (!initiative.valid) return
    const { command } = buildInitiativeCommand(sheet, {
      unspentCelerity,
      targetName: sheet.header.nombre,
      isOwn,
    })
    if (command) onCompose?.({ command })
  }

  const applyHealthResult = (result, successMessage) => {
    if (!result.ok) {
      setHealthFeedback(result.reason)
      return
    }
    onChange?.({ ...sheet, salud: result.health })
    setHealthFeedback(successMessage)
    setPendingHealth(null)
  }

  const requestHealthChange = (action, mark) => {
    if (!healthEditable) return
    setHealthFeedback('')
    const result = action === 'add'
      ? addHealthDamage(sheet.salud, mark)
      : removeHealthDamage(sheet.salud, mark)
    if (result.requiresConfirmation) {
      setPendingHealth({ action, mark, ...result })
      return
    }
    applyHealthResult(result, action === 'add' ? `Añadida 1 marca ${HEALTH_MARKS[mark].name.toLowerCase()}.` : `Quitada 1 marca ${HEALTH_MARKS[mark].name.toLowerCase()}.`)
  }

  const confirmHealthChange = () => {
    if (!pendingHealth || !healthEditable) return
    const { action, mark } = pendingHealth
    const result = action === 'add'
      ? addHealthDamage(sheet.salud, mark, { confirmed: true })
      : removeHealthDamage(sheet.salud, mark, { confirmed: true })
    applyHealthResult(result, action === 'add' ? `Añadida 1 marca ${HEALTH_MARKS[mark].name.toLowerCase()}.` : `Quitada 1 marca ${HEALTH_MARKS[mark].name.toLowerCase()}.`)
  }

  const editHealthSlot = (index) => {
    if (!healthEditable || !healthArrayValid) return
    const next = [...sheet.salud]
    next[index] = (next[index] + 1) % 4
    onChange?.({ ...sheet, salud: next })
    setPendingHealth(null)
    setHealthFeedback('Casilla editada manualmente.')
  }

  const prepareDisciplineRoll = () => {
    if (!selectedDiscipline) return
    const command = buildDisciplineCommand({
      count: disciplinePool,
      difficulty: disciplineDifficulty,
      discipline: selectedDiscipline.name,
      power: disciplinePower,
      targetName: sheet.header.nombre,
    })
    if (command) onCompose?.({ command })
  }

  const renderStatGroup = (title, group, getStat, setStatValue, idPrefix, specFor) => (
    <div className="sheet-stat-col">
      <h4>{title}</h4>
      {group.map((key) => {
        const id = `${idPrefix}:${key}`
        const stat = getStat(key)
        const specs = specFor?.[key] || []
        const safeId = id.replace(/:/g, '-')
        return (
          <div key={key} className="stat-block">
            <StatRow
              label={key}
              value={statValue(stat)}
              selected={pool.some((p) => p.id === id)}
              readOnly={readOnly}
              rollDisabled={rollDisabled}
              onToggle={() => togglePool(id, key)}
              onChange={(v) => setStatValue(key, { ...stat, v })}
              onRoll={() => composeOne(key, statValue(stat))}
            />
            {specs.length > 0 ? (
              <Combo
                id={`spec-${safeId}`}
                value={stat.spec}
                options={specs}
                readOnly={readOnly}
                onChange={(spec) => setStatValue(key, { ...stat, spec })}
                placeholder="Especialidad"
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )

  return (
    <>
    <div className="sheet-paper">
      <header className="sheet-masthead">
        <div className="sheet-mast-title">
          <span className="sheet-edition">Edición 20º Aniversario</span>
          <h1>Vampiro: La Mascarada</h1>
          <span className="sheet-edition">Hoja de personaje</span>
        </div>
        <div className="sheet-mast-side">
          <Avatar name={sheet.header.nombre} src={avatar} size={46} />
          {isOwn && onAvatar ? (
            <button
              type="button"
              className="ghost"
              onClick={() => fileRef.current?.click()}
              title="Cambiar la foto de tu personaje"
            >
              {avatar ? 'Cambiar foto' : 'Añadir foto'}
            </button>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="file-hidden"
            onChange={pickPhoto}
          />
          {avatarError ? <span className="hint bad">{avatarError}</span> : null}
          <span className={`sheet-status${status === 'Error al guardar' || status === 'Guardado cancelado' ? ' is-error' : status === 'Guardado' ? ' is-saved' : status ? ' is-saving' : ''}`} role="status" aria-live="polite">
            {readOnly ? 'Solo lectura · puedes armar tiradas' : status || 'Cambios automáticos'}
          </span>
          {status === 'Error al guardar' && !readOnly ? (
            <button type="button" className="sheet-retry-save" onClick={onRetrySave}>Reintentar guardado</button>
          ) : null}
        </div>
      </header>

      <nav className="sheet-nav" aria-label="Secciones de la ficha">
        <a href="#sheet-identidad">Identidad</a>
        <a href="#sheet-atributos">Atributos</a>
        <a href="#sheet-habilidades">Habilidades</a>
        <a href="#sheet-ventajas">Ventajas</a>
        <a href="#sheet-salud">Estado</a>
      </nav>

      <div className="sheet-rollbar">
        <div className="sheet-roll-copy">
          <strong>Arma tu reserva</strong>
          <p className="muted sheet-hint">Pulsa el nombre para combinar rasgos; usa ⚄ para enviar solo ese rasgo al campo de dados.</p>
        </div>
        <label className="spec-toggle">
          <input
            type="checkbox"
            checked={specialty}
            onChange={(e) => toggleSpecialty(e.target.checked)}
          />
          Con especialidad <span>(10 = 2 éxitos)</span>
        </label>
        <div className="sheet-quick-rolls">
          <section className="quick-roll-card" aria-labelledby="quick-initiative-title">
            <h4 id="quick-initiative-title">Iniciativa</h4>
            <div className="quick-roll-fields">
              <label>
                Celeridad no gastada (0–{celerityLevel})
                <input
                  type="number"
                  min="0"
                  max={celerityLevel}
                  value={Math.min(unspentCelerity, celerityLevel)}
                  disabled={!celerityLevel}
                  onChange={(event) => setUnspentCelerity(Math.max(0, Math.min(celerityLevel, Number(event.target.value) || 0)))}
                />
              </label>
            </div>
            {initiative.valid ? (
              <>
                <p className="quick-roll-preview">
                  1d10 + Destreza {initiative.dexterity} + Astucia {initiative.wits} − heridas {initiative.woundPenalty} + Celeridad {initiative.unspentCelerity} = 1d10{initiative.modifier < 0 ? initiative.modifier : `+${initiative.modifier}`}
                </p>
                <p className="muted quick-roll-note">Penalizador derivado de {health.level}: −{initiative.woundPenalty} dados en iniciativa.</p>
              </>
            ) : null}
            {initiative.incapacitated ? <p className="health-alert" role="status">Incapacitado: no se puede preparar iniciativa normal.</p> : null}
            {initiative.healthValid && initiative.healthIrregular ? <p className="health-alert" role="status">Pista de Salud irregular: se usa la casilla marcada más profunda, sin reordenar.</p> : null}
            {!initiative.healthValid ? <p className="health-alert" role="status">No se puede preparar iniciativa: el dato de Salud es incompatible y se conserva sin cambios; no se asumirá un penalizador.</p> : null}
            <p className="muted quick-roll-note">Los ajustes de turno son temporales y no se guardan en la ficha.</p>
            {!isOwn ? <p className="muted quick-roll-note">Ficha objetivo: {sheet.header.nombre || 'Personaje'}. La tirada se registra con la identidad de quien lanza.</p> : null}
            <button type="button" className="ghost" onClick={prepareInitiative} disabled={rollDisabled || !initiative.valid}>Preparar iniciativa</button>
          </section>

          <section className="quick-roll-card" aria-labelledby="quick-discipline-title">
            <h4 id="quick-discipline-title">Tiradas de Disciplinas</h4>
            {ownedDisciplines.length ? (
              <>
                <div className="quick-discipline-list" aria-label="Disciplinas disponibles">
                  {ownedDisciplines.map((discipline) => (
                    <button
                      key={`${discipline.index}-${discipline.name}`}
                      type="button"
                      className={activeDiscipline === discipline.name ? 'ghost is-on' : 'ghost'}
                      onClick={() => {
                        setActiveDiscipline((current) => current === discipline.name ? '' : discipline.name)
                        setDisciplinePower('')
                      }}
                      aria-pressed={activeDiscipline === discipline.name}
                    >
                      {discipline.name} · {discipline.level}
                    </button>
                  ))}
                </div>
                {selectedDiscipline ? (
                  <div className="quick-discipline-config">
                    <strong>{selectedDiscipline.name} · nivel {selectedDiscipline.level}</strong>
                    <div className="quick-roll-fields">
                      <label>
                        Poder (opcional)
                        <input value={disciplinePower} onChange={(event) => setDisciplinePower(event.target.value)} placeholder="Nombre del Poder" />
                      </label>
                      <label>
                        Reserva de dados
                        <input type="number" min="1" max="50" value={disciplinePool} onChange={(event) => setDisciplinePool(Math.max(1, Math.min(50, Number(event.target.value) || 1)))} />
                      </label>
                      <label>
                        Dificultad
                        <select value={disciplineDifficulty} onChange={(event) => setDisciplineDifficulty(Number(event.target.value))}>
                          {Array.from({ length: 9 }, (_, index) => index + 2).map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                      </label>
                    </div>
                    <p className="muted quick-roll-note">El nivel no determina la reserva: consulta el Poder para definir reserva, dificultad, coste y acción</p>
                    <button type="button" className="ghost" onClick={prepareDisciplineRoll} disabled={rollDisabled}>Preparar tirada WOD</button>
                  </div>
                ) : <p className="muted quick-roll-note">Elige una Disciplina para configurar una tirada.</p>}
                <p className="muted quick-roll-note">Estos controles son temporales y no se guardan en la ficha.</p>
              </>
            ) : <p className="muted quick-roll-note">Añade una Disciplina con nombre válido y nivel mayor que 0 para habilitar su tirada.</p>}
          </section>
        </div>
      </div>

      <div id="sheet-identidad" className="sheet-identity">
        <div className="sheet-id-col">
          <Field label="Nombre" value={sheet.header.nombre} readOnly={readOnly} onChange={(v) => setHeader('nombre', v)} />
          <Field label="Jugador" value={sheet.header.jugador} readOnly={readOnly} onChange={(v) => setHeader('jugador', v)} />
          <Field label="Crónica" value={sheet.header.cronica} readOnly={readOnly} onChange={(v) => setHeader('cronica', v)} />
        </div>
        <div className="sheet-id-col">
          <ComboField label="Naturaleza" id="combo-naturaleza" value={sheet.header.naturaleza} options={ARQUETIPOS} readOnly={readOnly} onChange={(v) => setHeader('naturaleza', v)} />
          <ComboField label="Conducta" id="combo-conducta" value={sheet.header.conducta} options={ARQUETIPOS} readOnly={readOnly} onChange={(v) => setHeader('conducta', v)} />
          <ComboField label="Concepto" id="combo-concepto" value={sheet.header.concepto} options={CONCEPTOS} readOnly={readOnly} onChange={(v) => setHeader('concepto', v)} />
        </div>
        <div className="sheet-id-col">
          <ComboField label="Clan" id="combo-clan" value={sheet.header.clan} options={CLANES} readOnly={readOnly} onChange={(v) => setHeader('clan', v)} />
          <ComboField label="Generación" id="combo-generacion" value={sheet.header.generacion} options={GENERACIONES} readOnly={readOnly} onChange={(v) => setHeader('generacion', v)} />
          <Field label="Sire" value={sheet.header.sire} readOnly={readOnly} onChange={(v) => setHeader('sire', v)} />
        </div>
      </div>

      <div className="sheet-body">
        <div className="sheet-main">
          <Section title="Atributos" id="sheet-atributos">
            <div className="sheet-tri">
              {renderStatGroup('Físicos', ATRIBUTOS.fisicos, (k) => sheet.atributos.fisicos[k], (k, s) => setAtributo('fisicos', k, s), 'a:fisicos', ESPECIALIDADES_ATRIBUTOS)}
              {renderStatGroup('Sociales', ATRIBUTOS.sociales, (k) => sheet.atributos.sociales[k], (k, s) => setAtributo('sociales', k, s), 'a:sociales', ESPECIALIDADES_ATRIBUTOS)}
              {renderStatGroup('Mentales', ATRIBUTOS.mentales, (k) => sheet.atributos.mentales[k], (k, s) => setAtributo('mentales', k, s), 'a:mentales', ESPECIALIDADES_ATRIBUTOS)}
            </div>
          </Section>
          <Section title="Habilidades" id="sheet-habilidades">
            <div className="sheet-tri">
              {renderStatGroup('Talentos', HABILIDADES.talentos, (k) => sheet.habilidades.talentos[k], (k, s) => setHabilidad('talentos', k, s), 'h:talentos', ESPECIALIDADES_HABILIDADES)}
              {renderStatGroup('Técnicas', HABILIDADES.tecnicas, (k) => sheet.habilidades.tecnicas[k], (k, s) => setHabilidad('tecnicas', k, s), 'h:tecnicas', ESPECIALIDADES_HABILIDADES)}
              {renderStatGroup('Conocimientos', HABILIDADES.conocimientos, (k) => sheet.habilidades.conocimientos[k], (k, s) => setHabilidad('conocimientos', k, s), 'h:conocimientos', ESPECIALIDADES_HABILIDADES)}
            </div>
          </Section>
        </div>

        <div className="sheet-side">
          <Section title="Ventajas" id="sheet-ventajas">
            <div className="sheet-side-grid">
              <div className="sheet-sub-col">
                <h4>Disciplinas</h4>
                {sheet.disciplinas.map((item, i) => (
                  <div key={i} className="stat-row list-row discipline-row">
                    <Combo
                      id={`combo-Disciplina-${i}`}
                      value={item.name}
                      options={DISCIPLINAS}
                      readOnly={readOnly}
                      onChange={(value) => setNamed('disciplinas', i, { name: value })}
                      placeholder="Disciplina"
                    />
                    <Dots value={item.level} readOnly={readOnly} onChange={(value) => setNamed('disciplinas', i, { level: value })} />
                  </div>
                ))}
              </div>
              <div className="sheet-sub-col">
                <h4>Trasfondos</h4>
                {sheet.trasfondos.map((item, i) => (
                  <NamedRow
                    key={i}
                    placeholder="Trasfondo"
                    options={TRASFONDOS}
                    item={item}
                    index={i}
                    selected={pool.some((p) => p.id === `t:${i}`)}
                    readOnly={readOnly}
                    rollDisabled={rollDisabled}
                    onName={(idx, v) => setNamed('trasfondos', idx, { name: v })}
                    onLevel={(idx, v) => setNamed('trasfondos', idx, { level: v })}
                    onToggle={() => togglePool(`t:${i}`, item.name || 'Trasfondo')}
                    onRoll={() => composeOne(item.name || 'Trasfondo', item.level)}
                  />
                ))}
              </div>
              <div className="sheet-sub-col">
                <h4>Virtudes</h4>
                <VirtueRow
                  name={sheet.virtudes.concienciaNombre}
                  nameOptions={VIRTUD_CONCIENCIA}
                  value={sheet.virtudes.conciencia}
                  selected={pool.some((p) => p.id === 'v:conciencia')}
                  readOnly={readOnly}
                  rollDisabled={rollDisabled}
                  onName={(v) => setVirtud('concienciaNombre', v)}
                  onToggle={() => togglePool('v:conciencia', sheet.virtudes.concienciaNombre)}
                  onValue={(v) => setVirtud('conciencia', v)}
                  onRoll={() => composeOne(sheet.virtudes.concienciaNombre, sheet.virtudes.conciencia)}
                />
                <VirtueRow
                  name={sheet.virtudes.autocontrolNombre}
                  nameOptions={VIRTUD_AUTOCONTROL}
                  value={sheet.virtudes.autocontrol}
                  selected={pool.some((p) => p.id === 'v:autocontrol')}
                  readOnly={readOnly}
                  rollDisabled={rollDisabled}
                  onName={(v) => setVirtud('autocontrolNombre', v)}
                  onToggle={() => togglePool('v:autocontrol', sheet.virtudes.autocontrolNombre)}
                  onValue={(v) => setVirtud('autocontrol', v)}
                  onRoll={() => composeOne(sheet.virtudes.autocontrolNombre, sheet.virtudes.autocontrol)}
                />
                <StatRow
                  label="Coraje"
                  value={sheet.virtudes.coraje}
                  selected={pool.some((p) => p.id === 'v:coraje')}
                  readOnly={readOnly}
                  rollDisabled={rollDisabled}
                  onToggle={() => togglePool('v:coraje', 'Coraje')}
                  onChange={(v) => setVirtud('coraje', v)}
                  onRoll={() => composeOne('Coraje', sheet.virtudes.coraje)}
                />
                <div className="sheet-sub">
                  <ComboField label="Senda" id="combo-senda" value={sheet.senda.nombre} options={SENDAS} readOnly={readOnly} onChange={(v) => setSenda('nombre', v)} />
                  <NumField label="Nivel de senda" value={sheet.senda.nivel} min={0} max={10} readOnly={readOnly} onChange={(v) => setSenda('nivel', v)} />
                  <Field label="Debilidad" value={sheet.senda.debilidad} readOnly={readOnly} onChange={(v) => setSenda('debilidad', v)} />
                </div>
              </div>
            </div>
          </Section>

          <Section title="Méritos y Defectos">
            <div className="sheet-side-grid two">
              <div className="sheet-sub-col">
                <h4>Méritos (coste +)</h4>
                {sheet.meritos.map((item, i) => (
                  <CostRow
                    key={i}
                    label="Mérito"
                    options={MERITOS}
                    item={item}
                    index={i}
                    readOnly={readOnly}
                    onName={(idx, v) => setNamed('meritos', idx, { name: v })}
                    onCost={(idx, v) => setNamed('meritos', idx, { cost: v })}
                  />
                ))}
              </div>
              <div className="sheet-sub-col">
                <h4>Defectos (coste −)</h4>
                {sheet.defectos.map((item, i) => (
                  <CostRow
                    key={i}
                    label="Defecto"
                    options={DEFECTOS}
                    item={item}
                    index={i}
                    readOnly={readOnly}
                    onName={(idx, v) => setNamed('defectos', idx, { name: v })}
                    onCost={(idx, v) => setNamed('defectos', idx, { cost: v })}
                  />
                ))}
              </div>
            </div>
          </Section>
        </div>
      </div>

      <div className="sheet-state">
        <Section title="Salud" id="sheet-salud">
          <div className="health-legend" aria-label="Leyenda de marcas de daño">
            {Object.entries(HEALTH_MARKS).map(([mark, detail]) => (
              <span key={mark}><b aria-hidden="true">{detail.symbol}</b> {detail.name}</span>
            ))}
          </div>
          <p className={`health-summary${health.incapacitated ? ' is-incapacitated' : ''}`} role="status" aria-live="polite">
            {!health.valid
              ? 'Estado actual: dato de Salud incompatible preservado; no se puede calcular.'
              : health.incapacitated
                ? 'Incapacitado · sin acciones normales'
                : health.levelIndex < 0
                  ? 'Estado actual: Sin heridas · 0 dados'
                  : `Estado actual: ${health.level} · −${health.penalty} ${health.penalty === 1 ? 'dado' : 'dados'} (no sube dificultad; no se suman)`}
          </p>
          <div className="health-grid">
            {HEALTH_LEVELS.map((level, i) => {
              const state = healthArrayValid ? sheet.salud[i] : null
              const effective = health.valid && health.levelIndex === i
              const penalty = HEALTH_LEVEL_PENALTIES[i]
              return (
                <button
                  key={level}
                  type="button"
                  className={`health${state > 0 ? ` is-${state}` : ''}${effective ? ' is-effective' : ''}${!healthArrayValid ? ' is-incompatible' : ''}`}
                  disabled={!healthEditable || !healthArrayValid}
                  onClick={() => editHealthSlot(i)}
                  title={healthArrayValid ? `${level} · ${penalty === null ? 'sin acciones normales' : penalty ? `−${penalty} dados` : 'sin penalizador'}. Clic para editar esta casilla.` : `${level}: dato de Salud incompatible`}
                  aria-label={healthArrayValid ? `${level}, ${state ? HEALTH_MARKS[state]?.name : 'vacía'}${effective ? ', estado efectivo' : ''}${penalty === null ? ', sin acciones normales' : `, penalizador ${penalty ? `menos ${penalty}` : 'ninguno'}`}` : `${level}, dato incompatible preservado`}
                  aria-pressed={effective}
                >
                  <span className="health-point" aria-hidden="true">{healthArrayValid ? HEALTH_SYMBOLS[state] : '?'}</span>
                  <span className="health-name">{level}</span>
                  <span className="health-pen">{penalty === null ? 'Sin acciones' : penalty ? `−${penalty} dados` : '0 dados'}</span>
                </button>
              )
            })}
          </div>
          {!health.valid ? (
            <p className="health-alert" role="alert">Dato incompatible preservado; no puedo editarlo ni aplicar operaciones de daño. No se ha convertido a una pista vacía ni se reemplazará automáticamente.</p>
          ) : health.irregular ? (
            <p className="health-alert" role="status">Pista irregular (huecos u orden no canónico). El estado usa la casilla más profunda marcada; la pista no se ha cambiado.</p>
          ) : null}
          {!healthArrayValid ? (
            <p className="muted health-note">El control no ofrece mutaciones mientras Salud sea incompatible. Los demás campos de la ficha conservan este dato sin alterarlo.</p>
          ) : !healthEditable ? (
            <p className="muted health-note">{readOnly ? 'Ficha de solo lectura: no puedes editar su Salud.' : 'Salud no editable mientras la ficha está cargando o tiene un error de guardado.'}</p>
          ) : (
            <div className="health-controls">
              <div className="health-damage-actions" aria-label="Recibir daño">
                {[1, 2, 3].map((mark) => (
                  <button key={mark} type="button" className="ghost" onClick={() => requestHealthChange('add', mark)} disabled={!healthArrayValid}>
                    Recibir +1 {HEALTH_MARKS[mark].name.toLowerCase()}
                  </button>
                ))}
              </div>
              <div className="health-remove-action">
                <label htmlFor="health-remove-type">Tipo de marca</label>
                <select id="health-remove-type" value={healthRemoveType} onChange={(event) => setHealthRemoveType(event.target.value)} disabled={!healthArrayValid}>
                  {[1, 2, 3].map((mark) => <option key={mark} value={mark}>{HEALTH_MARKS[mark].name}</option>)}
                </select>
                <button type="button" className="ghost" onClick={() => requestHealthChange('remove', Number(healthRemoveType))} disabled={!healthArrayValid}>
                  Quitar 1 marca
                </button>
              </div>
              <p className="muted health-note">Editar pista o quitar una marca es solo una corrección del registro: no cobra Sangre ni descanso, ni resuelve recuperación. Según el Manual, el daño normal se cura antes que el agravado.</p>
            </div>
          )}
          {pendingHealth && healthEditable ? (
            <div className="health-confirm" role="alertdialog" aria-labelledby="health-confirm-title" aria-describedby="health-confirm-description">
              <strong id="health-confirm-title">Confirmar cambio y compactar pista</strong>
              <p id="health-confirm-description">{pendingHealth.action === 'add'
                ? `Recibir +1 ${HEALTH_MARKS[pendingHealth.mark].name.toLowerCase()} reorganizará la pista.`
                : `Quitar 1 ${HEALTH_MARKS[pendingHealth.mark].name.toLowerCase()} compactará las casillas.`} Conteos antes → después: {formatHealthCounts(pendingHealth.beforeCounts)} → {formatHealthCounts(pendingHealth.afterCounts)}.</p>
              <div className="health-confirm-actions">
                <button type="button" className="ghost" onClick={confirmHealthChange} disabled={!healthEditable}>Confirmar</button>
                <button type="button" className="ghost" onClick={() => setPendingHealth(null)}>Cancelar</button>
              </div>
            </div>
          ) : null}
          {healthFeedback ? <p className="health-feedback" role="status" aria-live="polite">{healthFeedback}</p> : null}
          <p className="muted health-note">Los penalizadores afectan los dados de acciones pertinentes, no la dificultad ni todas las reservas; las tiradas reflejas (como absorción o Virtudes) están exentas. La ficha no infiere el contexto de otras tiradas.</p>
        </Section>

        <Section title="Fuerza de Voluntad y Reservas">
          <div className="sheet-reserve">
            <div className="sheet-reserve-item">
              <h4>Fuerza de Voluntad</h4>
              <Dots value={sheet.fuerzaVoluntad.max} max={10} readOnly={readOnly} onChange={(v) => setEstado('fuerzaVoluntad', { max: v, actual: sheet.fuerzaVoluntad.actual })} />
              <NumField label="Actual" value={sheet.fuerzaVoluntad.actual} min={0} max={sheet.fuerzaVoluntad.max} readOnly={readOnly} onChange={(v) => setEstado('fuerzaVoluntad', { max: sheet.fuerzaVoluntad.max, actual: v })} />
            </div>
            <div className="sheet-reserve-item">
              <h4>Reserva de Sangre</h4>
              <NumField label="Máx." value={sheet.sangre.max} min={0} readOnly={readOnly} onChange={(v) => setEstado('sangre', { ...sheet.sangre, max: v })} />
              <NumField label="Actual" value={sheet.sangre.actual} min={0} max={sheet.sangre.max} readOnly={readOnly} onChange={(v) => setEstado('sangre', { ...sheet.sangre, actual: v })} />
              <NumField label="Sangre por turno" value={sheet.sangre.porTurno} min={0} readOnly={readOnly} onChange={(v) => setEstado('sangre', { ...sheet.sangre, porTurno: v })} />
            </div>
            <div className="sheet-reserve-item">
              <h4>Experiencia</h4>
              <NumField label="Total" value={sheet.experiencia.total} min={0} readOnly={readOnly} onChange={(v) => setEstado('experiencia', { ...sheet.experiencia, total: v })} />
              <NumField label="Gastada" value={sheet.experiencia.gastada} min={0} readOnly={readOnly} onChange={(v) => setEstado('experiencia', { ...sheet.experiencia, gastada: v })} />
            </div>
          </div>
        </Section>
      </div>

      <footer className="sheet-footer">
        <div className="sheet-footer-item">
          <ComboField label="Porte" id="combo-porte" value={sheet.header.porte} options={PORTES} readOnly={readOnly} onChange={(v) => setHeader('porte', v)} />
        </div>
        <div className="sheet-footer-item">
          <Field label="Grado de Porte" value={sheet.header.gradoPorte} readOnly={readOnly} onChange={(v) => setHeader('gradoPorte', v)} />
          <p className="muted sheet-hint">Depende de Humanidad/Senda y solo aplica a tiradas pertinentes; es una referencia manual, no un cálculo canónico.</p>
        </div>
        <p className="muted sheet-budget">{POINT_BUDGET}</p>
      </footer>
      </div>
      {cropSrc ? (
        <AvatarCrop
          src={cropSrc}
          onCancel={() => setCropSrc(null)}
          onConfirm={confirmAvatar}
        />
      ) : null}
    </>
  )
}
