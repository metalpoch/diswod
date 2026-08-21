import { useEffect, useRef, useState } from 'react'
import { loadNotes, saveNotes } from '../lib/mesasApi'

export default function NotesPad({ mesaId, playerId }) {
  const [character, setCharacter] = useState('')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState('')
  const timer = useRef(null)

  useEffect(() => {
    if (!mesaId || !playerId) return undefined
    let active = true
    loadNotes(mesaId, playerId).then((row) => {
      if (!active) return
      setCharacter(row.character_name || '')
      setBody(row.body || '')
    }).catch(() => {})
    return () => {
      active = false
    }
  }, [mesaId, playerId])

  const queue = (nextChar, nextBody) => {
    setStatus('Guardando…')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      saveNotes(mesaId, playerId, { characterName: nextChar, body: nextBody })
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
      <input
        value={character}
        onChange={(e) => {
          setCharacter(e.target.value)
          queue(e.target.value, body)
        }}
        placeholder="Nombre del personaje"
      />
      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value)
          queue(character, e.target.value)
        }}
        placeholder="Atributos, disciplina, contactos, secretos…"
      />
    </section>
  )
}
