import { useEffect, useState } from 'react'
import { colorFromName, randomRoom } from '../lib/discord'
import Avatar from './Avatar'

export default function NameGate({ participants, identity, onSubmit }) {
  const [name, setName] = useState(identity?.name || '')
  const [selected, setSelected] = useState(identity?.id || '')

  useEffect(() => {
    if (identity?.name) setName(identity.name)
    if (identity?.id) setSelected(identity.id)
  }, [identity])

  const pickParticipant = (player) => {
    setSelected(player.id)
    setName(player.name)
  }

  const confirm = (event) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const fromList = participants.find((p) => p.id === selected)
    onSubmit({
      id: fromList?.id || identity?.id || `local-${randomRoom()}`,
      name: fromList?.name || trimmed,
      avatar: fromList?.avatar || null,
      color: colorFromName(fromList?.name || trimmed),
    })
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <p className="eyebrow">Camarilla · Anarquistas · Sabbat</p>
        <h1>Diswod</h1>
        <p className="gate-lead">Vampiro: la Mascarada — V20</p>
        <p className="gate-copy">
          Entra en la crónica. Hay 4 asientos en la mesa. Elige tu nombre o preséntate.
        </p>

        {participants.length > 0 && (
          <div className="gate-people">
            {participants.map((player) => (
              <button
                key={player.id}
                type="button"
                className={selected === player.id ? 'is-on' : ''}
                onClick={() => pickParticipant(player)}
              >
                <Avatar name={player.name} src={player.avatar} size={40} />
                <span>{player.name}</span>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={confirm}>
          <label htmlFor="kindred-name">Nombre en mesa</label>
          <input
            id="kindred-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setSelected('')
            }}
            placeholder="Ej. Keiber"
            maxLength={32}
            autoFocus
          />
          <button type="submit" className="primary" disabled={!name.trim()}>
            Entrar en la crónica
          </button>
        </form>
      </div>
    </div>
  )
}
