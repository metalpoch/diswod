import { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'

export default function NameEdit({ name, avatar, onRename, onAvatar }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(name || '')
  const [avatarError, setAvatarError] = useState('')
  const fileRef = useRef(null)

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

  const pick = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setAvatarError('')
    onAvatar(file).catch((err) => {
      setAvatarError(err.message || 'No se pudo subir la foto')
    })
  }

  return (
    <div className="help">
      <button
        type="button"
        className="ghost name-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Cambiar el nombre o la foto de tu personaje"
      >
        <Avatar name={name} src={avatar} size={18} />
        {name || 'Sin personaje'} ✎
      </button>
      {open && (
        <form className="help-pop" onSubmit={submit}>
          <h3>Tu personaje</h3>
          <p>El nombre y la foto de tu personaje en esta mesa. El nombre también se actualiza en el historial.</p>
          <div className="avatar-picker">
            <Avatar name={name} src={avatar} size={56} />
            <button
              type="button"
              className="ghost"
              onClick={() => fileRef.current?.click()}
            >
              Cambiar foto
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="file-hidden"
              onChange={pick}
            />
          </div>
          {avatarError ? <p className="hint bad">{avatarError}</p> : null}
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
