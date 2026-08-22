import LegalLinks from './LegalLinks'

export default function DiscordOnly() {
  return (
    <div className="gate">
      <div className="gate-card">
        <p className="eyebrow">Camarilla · Anarquistas · Sabbat</p>
        <h1>Diswod</h1>
        <p className="gate-lead">Vampiro: la Mascarada — V20</p>
        <p className="gate-copy">
          Diswod solo está disponible como Activity de Discord.
          Entra a un canal de voz en Discord, abre el estante de actividades
          y lanza Diswod desde ahí.
        </p>
        <p className="gate-age">
          Contenido para mayores de 18 años.
        </p>
        <LegalLinks />
      </div>
    </div>
  )
}
