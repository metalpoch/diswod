import { useEffect, useRef, useState } from 'react'
import { loadNotes, saveNotes } from '../lib/mesasApi'

export default function NotesPad({ mesaId, playerId }) {
  const [body, setBody] = useState('')
  const [status, setStatus] = useState('')
  const timer = useRef(null)

  useEffect(() => {
    if (!mesaId || !playerId) return undefined
    let active = true
    loadNotes(mesaId, playerId).then((row) => {
      if (!active) return
      setBody(row.body || '')
    }).catch(() => {})
    return () => {
      active = false
    }
  }, [mesaId, playerId])

  const queue = (nextBody) => {
    setStatus('Guardando…')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      saveNotes(mesaId, playerId, nextBody)
        .then(() => setStatus('Guardado'))
        .catch(() => setStatus('Error al guardar'))
    }, 700)
  }

  return (
    <section className="tool-pane">
      <header>
        <h2>Bloc de notas</h2>
        <small>{status}</small>
      </header>
      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value)
          queue(e.target.value)
        }}
        placeholder="Atributos, disciplina, contactos, secretos…"
      />
    </section>
  )
}
