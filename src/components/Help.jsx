import { useState } from 'react'

const EXAMPLES = [
  ['/r 4wod6', 'WOD: 4 dados d10, dificultad 6'],
  ['/r 4wod6!', 'WOD con especialidad: los 10 cuentan 2 éxitos'],
  ['/r 4wod6 ataque sigiloso', 'WOD con descripción'],
  ['/r 3d10', 'Genérico: 3d10 (suma)'],
  ['/r 1d3', 'Genérico: 1 dado de 3 caras'],
  ['/r 1d10+4', 'Genérico con modificador'],
  ['/r 4wod6 + 3wod8', 'Suma de dos reservas a la vez'],
]

export default function Help() {
  const [open, setOpen] = useState(false)
  return (
    <div className="help">
      <button type="button" className="ghost icon" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        ?
      </button>
      {open && (
        <>
          <div className="help-backdrop" onClick={() => setOpen(false)} />
          <div className="help-pop">
            <div className="help-pop-head">
              <h3>Comandos</h3>
              <button type="button" className="help-close" onClick={() => setOpen(false)} aria-label="Cerrar">✕</button>
            </div>
            <ul>
              {EXAMPLES.map(([cmd, text]) => (
                <li key={cmd}>
                  <code>{cmd}</code>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            <p>WOD (<code>NwodD</code>): los 1 anulan éxitos. Dificultad 2–10. Con <code>!</code> (especialidad) los 10 cuentan 2 éxitos.</p>
            <p>Genérico (<code>NdS</code>): suma los dados, con modificador opcional (<code>/r 1d10+0</code>).</p>
            <p>Suma (<code>+</code>): lanza varias reservas a la vez (<code>/r 4wod6 + 3wod8</code>).</p>
            <p>
              <a href="/tos.html" target="_blank" rel="noreferrer">Condiciones</a>
              {' · '}
              <a href="/privacy.html" target="_blank" rel="noreferrer">Privacidad</a>
              {' · '}
              <a href="https://github.com/metalpoch/diswod/issues/new" target="_blank" rel="noreferrer">Soporte / denunciar</a>
            </p>
          </div>
        </>
      )}
    </div>
  )
}
