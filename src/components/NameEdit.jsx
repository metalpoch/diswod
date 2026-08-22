import { useEffect, useState } from 'react'

export default function NameEdit({ identity, onRename }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(identity?.name || '')

  useEffect(() => {
    setName(identity?.name || '')
  }, [identity?.name])

  const submit = (event) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onRename(trimmed)
    setOpen(false)
  }

  return (
    <div className="help">
      <button
        type="button"
        className="ghost name-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Cambiar tu nombre"
      >
        {identity?.name || 'Sin nombre'} ✎
      </button>
      {open && (
        <form className="help-pop" onSubmit={submit}>
          <h3>Tu nombre</h3>
          <p>Así te ve el resto de jugadores en la mesa.</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
            autoFocus
            placeholder=""
          />
          <button type="submit" className="primary" disabled={!name.trim()}>
            Guardar
          </button>
        </form>
      )}
    </div>
  )
}
