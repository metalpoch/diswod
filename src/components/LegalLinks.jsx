export const SUPPORT_URL = 'https://github.com/metalpoch/diswod/issues/new'
export const TOS_PATH = '/tos.html'
export const PRIVACY_PATH = '/privacy.html'

export default function LegalLinks({ className = 'legal-links' }) {
  return (
    <p className={className}>
      <a href={TOS_PATH} target="_blank" rel="noreferrer">Condiciones</a>
      {' · '}
      <a href={PRIVACY_PATH} target="_blank" rel="noreferrer">Privacidad</a>
      {' · '}
      <a href={SUPPORT_URL} target="_blank" rel="noreferrer">Soporte / denunciar</a>
    </p>
  )
}
