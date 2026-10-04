import { useRef } from 'react'
import { frenzyForPlayer } from '../lib/scene'

function updateCaption(row, members) {
  const updatedAt = row?.updated_at || row?.updatedAt
  const updatedBy = row?.updated_by || row?.updatedBy
  if (!updatedAt) return ''
  const name = members.find((member) => member.player_id === updatedBy)?.name || 'Narrador'
  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) return `Último cambio: ${name}`
  return `Último cambio: ${name} · ${new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short' }).format(date)}`
}

export default function ScenePanel({ members, tracks, music, conditions, ready, error, onRetry, controlError, controlRetryable, onRetryControl, controlAccessMessage, canControl, playbackError, localFallback, onRetryMusic, onUseAutomatic, isDm, onMusic, onFrenzy, backgroundUrl, onSetBackground, onClearBackground }) {
  const selected = music.mode === 'off' ? 'off' : music.mode === 'track' ? `track:${music.trackId}` : 'auto'
  const backgroundFileRef = useRef(null)
  return (
    <section className="scene-panel" aria-labelledby="scene-title">
      <header className="scene-header">
        <div>
          <h2 id="scene-title">Escena</h2>
          <p>Música de mesa y estados narrativos compartidos.</p>
        </div>
        {!ready ? <span className="scene-sync" role="status">Sincronizando…</span> : null}
      </header>

      {error ? (
        <div className="scene-error" role="alert">
          <span>{error}</span>
          <button type="button" className="ghost" onClick={onRetry}>Volver a intentar</button>
        </div>
      ) : null}

      {controlError ? (
        <div className="scene-error" role="alert">
          <span>{controlError}</span>
          {controlRetryable ? <button type="button" className="ghost" onClick={onRetryControl}>Volver a intentar</button> : null}
        </div>
      ) : null}

      <section className="scene-music" aria-labelledby="scene-music-title">
        <div className="scene-section-heading">
          <h3 id="scene-music-title">Música</h3>
          <span>{!ready ? 'Estado sin confirmar' : music.mode === 'off' ? 'Apagada' : music.mode === 'track' ? 'Pista elegida' : 'Lista automática'}</span>
        </div>
        {canControl ? (
          <label className="scene-select-label">
            Selección para la mesa
            <select
              aria-label="Música de la mesa"
              value={selected}
              disabled={!ready || !tracks.length}
              onChange={(event) => {
                const value = event.target.value
                if (value === 'auto' || value === 'off') onMusic(value)
                else if (value.startsWith('track:')) onMusic('track', value.slice(6))
              }}
            >
              <option value="auto">Lista automática actual</option>
              {tracks.map((track) => <option key={track.id} value={`track:${track.id}`}>{track.title}</option>)}
              <option value="off">Música apagada</option>
            </select>
          </label>
        ) : (
          <p className="scene-current-music">
            {!ready ? 'No se conoce todavía el ajuste de música de esta mesa.' : music.mode === 'off' ? 'El Narrador ha apagado la música.' : music.mode === 'track'
              ? `Pista: ${tracks.find((track) => track.id === music.trackId)?.title || 'Lista automática actual'}`
              : 'Lista automática actual'}
          </p>
        )}
        {updateCaption(music, members) ? <p className="scene-update-meta">{updateCaption(music, members)}</p> : null}
        {music.stale ? <p className="scene-warning" role="status">La selección anterior ya no está disponible; se usa la lista automática actual.</p> : null}
        {playbackError ? (
          <div className="scene-warning" role="status">
            <span>{localFallback ? 'No se pudo reproducir la pista elegida; se prueba la lista automática localmente.' : 'No se pudo reproducir la música; la reproducción está detenida.'}</span>
            <button type="button" className="ghost" onClick={onRetryMusic}>Reintentar</button>
            {!localFallback && music.mode === 'track' ? <button type="button" className="ghost" onClick={onUseAutomatic}>Volver a auto</button> : null}
          </div>
        ) : null}
        {!tracks.length ? <p className="scene-muted">No se pudo cargar la lista de audio.</p> : null}
        {controlAccessMessage ? <p className="scene-auth-hint" role="status">{controlAccessMessage}</p> : null}
        {canControl ? <p className="scene-muted">El mute ♪ de cada jugador sigue siendo individual y local.</p> : null}
      </section>

      <section className="scene-conditions" aria-labelledby="scene-conditions-title">
        <div className="scene-section-heading">
          <h3 id="scene-conditions-title">Estado narrativo por personaje</h3>
          <span>{members.length} en roster</span>
        </div>
        <p className="scene-help">Frenesí / La Bestia es un estado narrativo manual; no cambia tiradas ni recursos. Hambre (Sangre baja) y Fuerza de Voluntad temporal 0 son lecturas derivadas de la ficha, no activadores automáticos; aquí no se muestran valores de otras fichas.</p>
        {members.length ? (
          <ul className="scene-roster">
            {members.map((member) => {
              const active = frenzyForPlayer(conditions, member.player_id)
              const condition = conditions.find((item) => item.key === 'frenzy' && item.player_id === member.player_id)
              const eligible = member.role !== 'visitor'
              return (
                <li key={member.player_id} className="scene-roster-row">
                  <div className="scene-character">
                    <strong>{member.name || 'Kindred'}</strong>
                    <span>{member.role === 'dm' ? 'Narrador' : member.role === 'visitor' ? 'Visitante' : 'Jugador'}</span>
                  </div>
                  <div className="scene-frenzy">
                    <div className="scene-state-copy">
                      <span className={active ? 'scene-status is-active' : 'scene-status'}>{active ? 'Frenesí / La Bestia' : 'Sin Frenesí'}</span>
                      {updateCaption(condition, members) ? <span className="scene-update-meta">{updateCaption(condition, members)}</span> : null}
                    </div>
                    {canControl ? (
                      <button
                        type="button"
                        className={active ? 'ghost scene-toggle is-on' : 'ghost scene-toggle'}
                        disabled={!ready || !eligible}
                        aria-label={`${active ? 'Quitar' : 'Activar'} Frenesí para ${member.name || 'personaje'}`}
                        onClick={() => onFrenzy(member.player_id, !active)}
                        title={eligible ? 'Cambiar estado narrativo' : 'No se puede asignar Frenesí a visitantes'}
                      >
                        {active ? 'Quitar' : 'Activar'}
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : <p className="scene-muted">Aún no hay personajes en el roster de esta mesa.</p>}
      </section>

      {isDm ? (
        <section className="scene-background" aria-labelledby="scene-background-title">
          <div className="scene-section-heading">
            <h3 id="scene-background-title">Fondo de mesa</h3>
          </div>
          <p className="scene-help">Sube una imagen de ubicación para ambientar la mesa 3D.</p>
          {backgroundUrl ? <img className="scene-background-preview" src={backgroundUrl} alt="Vista previa del fondo actual de la mesa" /> : null}
          <div className="bg-actions">
            <button type="button" className="ghost" onClick={() => backgroundFileRef.current?.click()}>
              {backgroundUrl ? 'Cambiar fondo' : 'Subir fondo'}
            </button>
            {backgroundUrl ? <button type="button" className="ghost danger" onClick={onClearBackground}>Quitar fondo</button> : null}
          </div>
          <input
            ref={backgroundFileRef}
            type="file"
            accept="image/*"
            className="file-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              onSetBackground?.(file)
            }}
          />
          <p className="scene-security-note">Nota de seguridad: el fondo todavía se guarda mediante un callback del cliente y RLS abierto. Mover este control a Escena no lo protege como Música/Frenesí, que verifican el Narrador en el servidor.</p>
        </section>
      ) : null}
    </section>
  )
}
