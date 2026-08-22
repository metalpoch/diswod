import { useState } from 'react'

const EXAMPLES = [
  ['/r 3d5', 'WOD: 3 dados, dificultad 5'],
  ['/r 3d6 ataque sigiloso', 'WOD con descripción'],
  ['/r 1d10+4', 'Genérico: 1d10 + 4'],
  ['/r 2d6-2', 'Genérico con penalizador'],
  ['/r 1d10+3 iniciativa de Keiber', 'Genérico con descripción'],
]

export default function Help() {
  const [open, setOpen] = useState(false)
  return (
    <div className="help">
      <button type="button" className="ghost icon" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        ?
      </button>
      {open && (
        <div className="help-pop">
          <h3>Comandos</h3>
          <ul>
            {EXAMPLES.map(([cmd, text]) => (
              <li key={cmd}>
                <code>{cmd}</code>
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <p>WOD: los 10 explotan, los 1 anulan éxitos. Dificultad 2–10.</p>
          <p>Genérico: siempre con modificador (<code>/r 1d10+0</code>).</p>
          <p>
            <a href="/tos.html" target="_blank" rel="noreferrer">Condiciones</a>
            {' · '}
            <a href="/privacy.html" target="_blank" rel="noreferrer">Privacidad</a>
            {' · '}
            <a href="https://github.com/metalpoch/diswod/issues/new" target="_blank" rel="noreferrer">Soporte / denunciar</a>
          </p>
        </div>
      )}
    </div>
  )
}
