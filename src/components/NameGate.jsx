import { useState } from 'react'
import { colorFromName, randomRoom } from '../lib/discord'
import { localIdentity, participantFallbackIdentity } from '../lib/activityIdentity'
import Avatar from './Avatar'
import IdentityStatus from './IdentityStatus'
import LegalLinks from './LegalLinks'

export default function NameGate({ participants, identity, onSubmit, embedded, diagnosticMessage = '' }) {
  const [selected, setSelected] = useState(identity?.id || '')

  const pickParticipant = (player) => {
    setSelected(player.id)
  }

  const confirm = (event) => {
    event.preventDefault()
    if (embedded) {
      const fromList = participantFallbackIdentity(
        participants.find((p) => p.id === selected),
        participants,
      )
      if (!fromList) return
      onSubmit({
        ...fromList,
        color: colorFromName(fromList.name),
      })
      return
    }
    const name = identity?.name || 'Jugador'
    const local = identity?.source === 'local' ? identity : localIdentity(name, randomRoom)
    onSubmit({ ...local, color: colorFromName(name) })
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
        <IdentityStatus identity={identity} mode={embedded ? 'discord' : 'standalone'} />
        {diagnosticMessage && <p className="gate-copy" role="status">{diagnosticMessage}</p>}

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
          <button
            type="submit"
            className="primary"
            disabled={embedded ? !participants.some((player) => player.id === selected) : false}
          >
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
