import { useRef, useState } from 'react'
import Avatar from './Avatar'
import AvatarCrop from './AvatarCrop'
import {
  ATRIBUTOS,
  HABILIDADES,
  HEALTH_LEVELS,
  HEALTH_PENALTIES,
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

const HEALTH_SYMBOLS = ['', '/', 'X', '*']

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
        disabled={readOnly}
        title={label}
      >
        {label}
      </button>
      <Dots value={value} readOnly={readOnly} onChange={onChange} />
      <button
        type="button"
        className="stat-roll"
        onClick={onRoll}
        disabled={readOnly || rollDisabled || !value}
        title={value ? `Tirar ${value}d10` : 'Sin puntos'}
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
        disabled={readOnly}
        title="Añadir o quitar de la tirada combinada"
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
        disabled={readOnly || rollDisabled || !value}
        title={value ? `Tirar ${value}d10` : 'Sin puntos'}
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
        disabled={readOnly}
        title="Añadir o quitar de la tirada combinada"
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
        disabled={readOnly || rollDisabled || !item.level}
        title={item.level ? `Tirar ${item.level}d10` : 'Sin nivel'}
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

function Section({ title, children, className }) {
  return (
    <section className={className ? `sheet-section ${className}` : 'sheet-section'}>
      <header className="sheet-section-head"><h3>{title}</h3></header>
      <div className="sheet-section-body">{children}</div>
    </section>
  )
}

export default function CharacterSheet({
  sheet,
  readOnly,
  status,
  rollDisabled,
  onChange,
  onRoll,
  avatar,
  onAvatar,
  isOwn,
}) {
  const [difficulty, setDifficulty] = useState(6)
  const [pool, setPool] = useState([])
  const [cropSrc, setCropSrc] = useState(null)
  const [avatarError, setAvatarError] = useState('')
  const fileRef = useRef(null)

  const togglePool = (id, label) => {
    setPool((prev) => (
      prev.some((p) => p.id === id)
        ? prev.filter((p) => p.id !== id)
        : [...prev, { id, label }]
    ))
  }

  const statValue = (s) => (s && typeof s === 'object' ? Number(s.v) || 0 : Number(s) || 0)

  const valueOf = (id) => {
    const [kind, a, b] = id.split(':')
    if (kind === 'a') return statValue(sheet.atributos[a]?.[b])
    if (kind === 'h') return statValue(sheet.habilidades[a]?.[b])
    if (kind === 'v') return Number(sheet.virtudes[b]) || 0
    if (kind === 'd') return Number(sheet.disciplinas[Number(a)]?.level) || 0
    if (kind === 't') return Number(sheet.trasfondos[Number(a)]?.level) || 0
    return 0
  }

  const poolTotal = pool.reduce((acc, p) => acc + valueOf(p.id), 0)
  const rollOne = (label, count) => {
    if (!count) return
    onRoll?.({ count, difficulty, description: label })
  }
  const rollPool = () => {
    if (!poolTotal) return
    onRoll?.({ count: poolTotal, difficulty, description: pool.map((p) => p.label).join(' + ') })
    setPool([])
  }

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

  const confirmAvatar = async (file) => {
    setCropSrc(null)
    try {
      await onAvatar?.(file)
    } catch (err) {
      setAvatarError(err.message || 'No se pudo subir la foto')
    }
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
              onRoll={() => rollOne(key, statValue(stat))}
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
          <small className="sheet-status">{status}</small>
        </div>
      </header>

      <div className="sheet-rollbar">
        <div className="difficulty">
          <span>Dificultad</span>
          <button type="button" className="ghost" onClick={() => setDifficulty((d) => Math.max(2, d - 1))} disabled={readOnly}>−</button>
          <strong>{difficulty}</strong>
          <button type="button" className="ghost" onClick={() => setDifficulty((d) => Math.min(10, d + 1))} disabled={readOnly}>+</button>
          <small>la fija el Narrador</small>
        </div>
        {pool.length > 0 ? (
          <div className="pool">
            <span className="pool-label">{pool.map((p) => p.label).join(' + ')}</span>
            <strong className="pool-total">{poolTotal}d10</strong>
            <button type="button" className="primary" onClick={rollPool} disabled={!poolTotal || rollDisabled}>Tirar</button>
            <button type="button" className="ghost" onClick={() => setPool([])}>Limpiar</button>
          </div>
        ) : (
          <p className="muted sheet-hint">Toca un nombre para combinar (p. ej. Destreza + Alerta) o el dado para tirar directo.</p>
        )}
      </div>

      <div className="sheet-identity">
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
          <Section title="Atributos">
            <div className="sheet-tri">
              {renderStatGroup('Físicos', ATRIBUTOS.fisicos, (k) => sheet.atributos.fisicos[k], (k, s) => setAtributo('fisicos', k, s), 'a:fisicos', ESPECIALIDADES_ATRIBUTOS)}
              {renderStatGroup('Sociales', ATRIBUTOS.sociales, (k) => sheet.atributos.sociales[k], (k, s) => setAtributo('sociales', k, s), 'a:sociales', ESPECIALIDADES_ATRIBUTOS)}
              {renderStatGroup('Mentales', ATRIBUTOS.mentales, (k) => sheet.atributos.mentales[k], (k, s) => setAtributo('mentales', k, s), 'a:mentales', ESPECIALIDADES_ATRIBUTOS)}
            </div>
          </Section>
          <Section title="Habilidades">
            <div className="sheet-tri">
              {renderStatGroup('Talentos', HABILIDADES.talentos, (k) => sheet.habilidades.talentos[k], (k, s) => setHabilidad('talentos', k, s), 'h:talentos', ESPECIALIDADES_HABILIDADES)}
              {renderStatGroup('Técnicas', HABILIDADES.tecnicas, (k) => sheet.habilidades.tecnicas[k], (k, s) => setHabilidad('tecnicas', k, s), 'h:tecnicas', ESPECIALIDADES_HABILIDADES)}
              {renderStatGroup('Conocimientos', HABILIDADES.conocimientos, (k) => sheet.habilidades.conocimientos[k], (k, s) => setHabilidad('conocimientos', k, s), 'h:conocimientos', ESPECIALIDADES_HABILIDADES)}
            </div>
          </Section>
        </div>

        <div className="sheet-side">
          <Section title="Ventajas">
            <div className="sheet-side-grid">
              <div className="sheet-sub-col">
                <h4>Disciplinas</h4>
                {sheet.disciplinas.map((item, i) => (
                  <NamedRow
                    key={i}
                    placeholder="Disciplina"
                    options={DISCIPLINAS}
                    item={item}
                    index={i}
                    selected={pool.some((p) => p.id === `d:${i}`)}
                    readOnly={readOnly}
                    rollDisabled={rollDisabled}
                    onName={(idx, v) => setNamed('disciplinas', idx, { name: v })}
                    onLevel={(idx, v) => setNamed('disciplinas', idx, { level: v })}
                    onToggle={() => togglePool(`d:${i}`, item.name || 'Disciplina')}
                    onRoll={() => rollOne(item.name || 'Disciplina', item.level)}
                  />
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
                    onRoll={() => rollOne(item.name || 'Trasfondo', item.level)}
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
                  onRoll={() => rollOne(sheet.virtudes.concienciaNombre, sheet.virtudes.conciencia)}
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
                  onRoll={() => rollOne(sheet.virtudes.autocontrolNombre, sheet.virtudes.autocontrol)}
                />
                <StatRow
                  label="Coraje"
                  value={sheet.virtudes.coraje}
                  selected={pool.some((p) => p.id === 'v:coraje')}
                  readOnly={readOnly}
                  rollDisabled={rollDisabled}
                  onToggle={() => togglePool('v:coraje', 'Coraje')}
                  onChange={(v) => setVirtud('coraje', v)}
                  onRoll={() => rollOne('Coraje', sheet.virtudes.coraje)}
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
        <Section title="Salud">
          <div className="health-grid">
            {HEALTH_LEVELS.map((level, i) => {
              const state = sheet.salud[i] || 0
              return (
                <button
                  key={level}
                  type="button"
                  className={state > 0 ? `health is-${state}` : 'health'}
                  disabled={readOnly}
                  onClick={() => onChange?.({
                    ...sheet,
                    salud: sheet.salud.map((n, j) => (j === i ? (n + 1) % 4 : n)),
                  })}
                  title={`${level} (penalización ${HEALTH_PENALTIES[i]})`}
                >
                  <span className="health-sym">{HEALTH_SYMBOLS[state]}</span>
                  <span className="health-name">{level}</span>
                  <span className="health-pen">{HEALTH_PENALTIES[i]}</span>
                </button>
              )
            })}
          </div>
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
