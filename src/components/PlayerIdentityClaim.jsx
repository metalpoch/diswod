export default function PlayerIdentityClaim({ claim, onClaim, onContinueDirect, onDismiss }) {
  if (!claim) return null
  return (
    <div className="modal-veil">
      <section className="gate-card modal-card identity-claim" aria-labelledby="identity-claim-title">
        <p className="eyebrow">Vínculo de identidad · {claim.mesa.name}</p>
        <h1 id="identity-claim-title">¿Quién eres?</h1>
        <p className="gate-copy">Elige tu personaje existente en esta mesa.</p>
        {claim.directMember ? (
          <div className="identity-claim-direct">
            <p>
              Ya existe un miembro con tu cuenta ({claim.directMember.playerName}). La fila legacy se conserva aparte; no se combinará ni sobrescribirá automáticamente.
            </p>
            <button type="button" className="ghost" disabled={claim.busy} onClick={() => onContinueDirect()}>
              Continuar con {claim.directMember.playerName}
            </button>
            <p className="muted">También puedes elegir explícitamente una fila legacy para vincularla como identidad efectiva de esta mesa.</p>
          </div>
        ) : null}
        <div className="identity-claim-list">
          {claim.candidates.map((candidate) => (
            <button
              type="button"
              className="ghost"
              key={candidate.playerId}
              disabled={claim.busy}
              onClick={() => {
                if (candidate.role === 'dm' && !window.confirm('Confirmo que soy el Narrador de esta mesa y que esta es mi propia fila legacy.')) return
                onClaim(candidate.playerId, candidate.role === 'dm').catch(() => {})
              }}
            >
              <span>{candidate.playerName}</span>
              <small>{candidate.role === 'dm' ? 'Narrador' : 'Jugador'}</small>
            </button>
          ))}
        </div>
        {claim.candidates.length === 0 ? (
          <p className="muted">No quedan miembros disponibles para vincular. Puede que otra cuenta los haya reclamado.</p>
        ) : null}
        <p className="hint">
          Solo reclama tu personaje. Es un vínculo por orden de llegada en una mesa privada y no demuestra por sí solo que la fila te pertenezca: confirma con el Narrador si tienes dudas. El primero en reclamar bloquea esa fila; para cambiar la asociación, pide ayuda al Narrador. Se conserva el nombre y los datos; el vínculo no cambia player_id.
        </p>
        {claim.error ? <p className="hint bad" role="alert">{claim.error}</p> : null}
        {claim.busy ? <p className="muted">Verificando y vinculando…</p> : null}
        <button type="button" className="ghost" onClick={onDismiss} disabled={claim.busy}>Cancelar</button>
      </section>
    </div>
  )
}
