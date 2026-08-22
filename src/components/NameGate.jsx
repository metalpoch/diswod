import { useEffect, useState } from 'react'
import { colorFromName, randomRoom } from '../lib/discord'
import Avatar from './Avatar'
import LegalLinks from './LegalLinks'

export default function NameGate({ participants, identity, onSubmit, embedded }) {
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
      source: fromList ? 'discord' : identity?.source || 'local',
    })
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <p className="eyebrow">Camarilla · Anarquistas · Sabbat</p>
        <h1>Diswod</h1>
        <p className="gate-lead">Vampiro: la Mascarada — V20</p>
        <p className="gate-copy">
          {embedded
            ? 'Elige tu usuario de Discord en esta Activity.'
            : 'Entra en la crónica. El Narrador te pasará un código de mesa.'}
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
          {!embedded ? (
            <>
              <label htmlFor="kindred-name">Tu nombre de jugador</label>
              <input
                id="kindred-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setSelected('')
                }}
                placeholder=""
                maxLength={32}
                autoFocus
              />
              <p className="gate-age">
                El nombre de tu personaje se define dentro de la mesa, en la pestaña Notas.
              </p>
            </>
          ) : null}
          <button type="submit" className="primary" disabled={embedded ? !selected : !name.trim()}>
            Entrar (tengo 13+ / contenido 18+)
          </button>
        </form>
        <p className="gate-age">
          Al entrar confirmas la edad mínima de Discord (13+) y que el rol vampírico está pensado para 18+.
        </p>
        <LegalLinks />
      </div>
    </div>
  )
}
