import { useState } from 'react'
import LegalLinks from './LegalLinks'

const KINDS = [
  { id: 'principal', label: 'Crónica principal' },
  { id: 'relajada', label: 'Historia relajada' },
  { id: 'oneshot', label: 'One shot' },
]

export default function MesaLobby({
  identity,
  mesas,
  loading,
  error,
  onOpen,
  onCreate,
  onJoin,
  onArchive,
  onReopen,
  onSkip,
  onErase,
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState('principal')
  const [charName, setCharName] = useState(identity?.name || '')
  const [code, setCode] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [busy, setBusy] = useState(false)
  const [joinError, setJoinError] = useState('')

  const visible = mesas.filter((m) => (showArchived ? m.status === 'archived' : m.status === 'active'))

  const submit = async (event) => {
    event.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      await onCreate({ name, description, kind })
    } finally {
      setBusy(false)
    }
  }

  const join = async (event) => {
    event.preventDefault()
    if (!code.trim() || busy) return
    setBusy(true)
    setJoinError('')
    try {
      await onJoin(code, charName)
    } catch (err) {
      setJoinError(err.message || 'Código inválido')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gate lobby">
      <div className="lobby-wrap">
        <header className="lobby-head">
          <p className="eyebrow">Archivo de crónicas</p>
          <h1>Mesas de {identity.name}</h1>
          <p className="gate-copy">
            Crea una mesa o entra con el código del Narrador. 4 asientos; el resto son visitantes.
          </p>
        </header>

        {error ? <p className="hint bad">{error}</p> : null}

        <form className="lobby-join" onSubmit={join}>
          <label htmlFor="char-name">Tu personaje</label>
          <input
            id="char-name"
            className="join-char"
            value={charName}
            onChange={(e) => setCharName(e.target.value)}
            maxLength={32}
            placeholder=""
          />
          <label htmlFor="invite-code">Código de invitación</label>
          <div className="join-row">
            <input
              id="invite-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXXXX"
              maxLength={8}
              autoCapitalize="characters"
            />
            <button type="submit" className="primary" disabled={!code.trim() || busy}>Unirse</button>
          </div>
          {joinError ? <p className="hint bad">{joinError}</p> : null}
        </form>

        <div className="lobby-grid">
          <section className="lobby-list">
            <div className="lobby-tabs">
              <button type="button" className={showArchived ? 'ghost' : 'ghost is-on'} onClick={() => setShowArchived(false)}>
                Activas
              </button>
              <button type="button" className={showArchived ? 'ghost is-on' : 'ghost'} onClick={() => setShowArchived(true)}>
                Archivo
              </button>
            </div>
            {loading ? <p className="muted">Cargando mesas…</p> : null}
            {!loading && visible.length === 0 ? (
              <p className="muted">{showArchived ? 'No hay crónicas archivadas.' : 'Aún no hay mesas. Crea una o únete con un código.'}</p>
            ) : null}
            <ul>
              {visible.map((mesa) => (
                <li key={mesa.id}>
                  <div>
                    <strong>{mesa.name}</strong>
                    <small>
                      {KINDS.find((k) => k.id === mesa.kind)?.label || mesa.kind}
                      {mesa.myRole === 'dm' ? ' · Narrador' : mesa.myRole === 'visitor' ? ' · Visitante' : ' · Jugador'}
                    </small>
                    {mesa.inviteCode ? <p className="invite-mini">Código {mesa.inviteCode}</p> : null}
                  </div>
                  <div className="lobby-actions">
                    {mesa.status === 'active' ? (
                      <>
                        <button type="button" className="primary" onClick={() => onOpen(mesa)}>Entrar</button>
                        {mesa.myRole === 'dm' ? (
                          <button type="button" className="ghost" onClick={() => onArchive(mesa)}>Archivar</button>
                        ) : null}
                      </>
                    ) : (
                      <button type="button" className="primary" onClick={() => onReopen(mesa)}>Retomar</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <form className="lobby-create" onSubmit={submit}>
            <h2>Nueva mesa</h2>
            <label htmlFor="mesa-name">Nombre</label>
            <input id="mesa-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Chicago by Night" maxLength={80} />
            <label htmlFor="mesa-kind">Tipo</label>
            <select id="mesa-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            <label htmlFor="mesa-desc">Sinopsis</label>
            <textarea id="mesa-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Una cacería en el downtown…" />
            <button type="submit" className="primary" disabled={!name.trim() || busy}>
              Crear y ser Narrador
            </button>
            <button type="button" className="ghost" onClick={onSkip}>
              Jugar sin guardar
            </button>
            <button type="button" className="ghost" onClick={onErase}>
              Borrar mis datos
            </button>
          </form>
        </div>
        <LegalLinks />
      </div>
    </div>
  )
}
