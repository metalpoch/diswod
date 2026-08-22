import { useState } from 'react'
import { colorFromName, randomRoom } from '../lib/discord'
import Avatar from './Avatar'
import LegalLinks from './LegalLinks'

export default function NameGate({ participants, identity, onSubmit, embedded }) {
  const [selected, setSelected] = useState(identity?.id || '')

  const pickParticipant = (player) => {
    setSelected(player.id)
  }

  const confirm = (event) => {
    event.preventDefault()
    if (embedded) {
      const fromList = participants.find((p) => p.id === selected)
      if (!fromList) return
      onSubmit({
        ...fromList,
        color: colorFromName(fromList.name),
        source: 'discord',
      })
      return
    }
    const name = identity?.name || 'Jugador'
    onSubmit({
      id: identity?.id || `local-${randomRoom()}`,
      name,
      avatar: identity?.avatar || null,
      color: colorFromName(name),
      source: identity?.source || 'local',
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
          <button type="submit" className="primary" disabled={embedded ? !selected : false}>
            Entrar (contenido 18+)
          </button>
        </form>
        <p className="gate-age">
          Al entrar confirmas que tienes 18 años o más.
        </p>
        <LegalLinks />
      </div>
    </div>
  )
}
