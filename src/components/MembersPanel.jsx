import { seatedCount } from '../lib/invite'
import Avatar from './Avatar'

const LABELS = { dm: 'Narrador', player: 'Jugador', visitor: 'Visitante' }

export default function MembersPanel({
  mesa,
  members,
  me,
  isDm,
  onCopy,
  onSetRole,
  onSetMuted,
  onKick,
  onLeave,
}) {
  const seated = seatedCount(members)

  return (
    <section className="tool-pane members-pane">
      <header>
        <h2>Coterie</h2>
        <small>{seated}/4 asientos</small>
      </header>

      {mesa?.inviteCode ? (
        <button
          type="button"
          className="invite-code"
          onClick={() => onCopy(mesa.inviteCode)}
        >
          Código {mesa.inviteCode}
          <span>copiar</span>
        </button>
      ) : null}

      <ul className="member-list">
        {members.map((member) => {
          const mine = member.player_id === me?.player_id
          return (
            <li key={member.player_id} className={mine ? 'is-self' : ''}>
              <Avatar name={member.name} src={member.avatar} size={32} />
              <div>
                <strong>{member.name}{mine ? ' (tú)' : ''}</strong>
                <small>{LABELS[member.role] || member.role}{member.muted ? ' · silenciado' : ''}</small>
              </div>
              {isDm && !mine ? (
                <div className="member-actions">
                  {member.role === 'visitor' ? (
                    <button type="button" className="ghost" onClick={() => onSetRole(member.player_id, 'player')}>
                      Asiento
                    </button>
                  ) : (
                    <button type="button" className="ghost" onClick={() => onSetRole(member.player_id, 'visitor')}>
                      Visitante
                    </button>
                  )}
                  <button type="button" className="ghost" onClick={() => onSetMuted(member.player_id, !member.muted)}>
                    {member.muted ? 'Activar' : 'Silenciar'}
                  </button>
                  <button type="button" className="ghost" onClick={() => onKick(member.player_id)}>
                    Expulsar
                  </button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      <button type="button" className="ghost" onClick={onLeave}>
        Salir de la mesa
      </button>
    </section>
  )
}
