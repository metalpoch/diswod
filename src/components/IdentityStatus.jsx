import { identityPresentation } from '../lib/activityIdentity'

export default function IdentityStatus({ identity, mode, presenceStatus }) {
  const presentation = identityPresentation(identity, mode)
  const presenceUnavailable = mode === 'discord'
    && identity?.source === 'discord-auth'
    && presenceStatus === 'unavailable'
  return (
    <span
      className={`identity-status identity-status-${presentation.kind}`}
      title={presenceUnavailable ? `${presentation.detail} El roster/presencia no está disponible.` : presentation.detail}
    >
      {presentation.label}
      {presenceUnavailable ? <span className="identity-presence-warning"> · presencia no disponible</span> : null}
    </span>
  )
}
