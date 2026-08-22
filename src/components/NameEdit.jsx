import { useEffect, useState } from 'react'

export default function NameEdit({ name, onRename }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(name || '')

  useEffect(() => {
    setValue(name || '')
  }, [name])

  const submit = (event) => {
    event.preventDefault()
    const trimmed = value.trim()
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
        title="Cambiar el nombre de tu personaje"
      >
        {name || 'Sin personaje'} ✎
      </button>
      {open && (
        <form className="help-pop" onSubmit={submit}>
          <h3>Tu personaje</h3>
          <p>El nombre de tu personaje en esta mesa. Se actualiza también en el historial.</p>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={32}
            autoFocus
          />
          <button type="submit" className="primary" disabled={!value.trim()}>
            Guardar
          </button>
        </form>
      )}
    </div>
  )
}
