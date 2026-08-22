import { useEffect, useState } from 'react'

export default function CharacterGate({ defaultName, onAccept, onDismiss }) {
  const [name, setName] = useState(defaultName || '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (defaultName) setName(defaultName)
  }, [defaultName])

  const submit = async (event) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    try {
      await onAccept(trimmed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-veil">
      <form className="gate-card modal-card" onSubmit={submit}>
        <p className="eyebrow">Bienvenido a la mesa</p>
        <h1>Tu personaje</h1>
        <p className="gate-copy">
          ¿Cómo se llama tu personaje en esta crónica? Podrás cambiarlo luego desde la mesa.
        </p>
        <label htmlFor="char-name">Nombre del personaje</label>
        <input
          id="char-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
          autoFocus
        />
        <button type="submit" className="primary" disabled={!name.trim() || busy}>
          Unirme (contenido 18+)
        </button>
        <button type="button" className="ghost" onClick={onDismiss} disabled={busy}>
          Ahora no
        </button>
        <p className="gate-age">
          Al unirte confirmas que tienes 18 años o más.
        </p>
      </form>
    </div>
  )
}
