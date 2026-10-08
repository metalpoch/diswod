import { useEffect, useState } from 'react'
import {
  cancelIdentityClaimSelection,
  chooseIdentityClaimCandidate,
  confirmIdentityClaim,
  identityClaimSelectionIsCurrent,
} from '../lib/playerIdentityLinks'

export default function PlayerIdentityClaim({ claim, onClaim, isClaimCurrent, onContinueDirect, onDismiss }) {
  const [selectedDm, setSelectedDm] = useState(null)
  const [submissionError, setSubmissionError] = useState('')

  useEffect(() => {
    setSelectedDm(null)
    setSubmissionError('')
  }, [claim?.context])

  if (!claim) return null

  const claimCandidate = async (candidate, confirmedDm = false, expectedContext = claim.context, expectedRole = candidate.role) => {
    setSubmissionError('')
    try {
      await onClaim(candidate.playerId, confirmedDm, expectedContext, expectedRole)
    } catch {
      // The hook keeps the detailed, sanitized claim error in claim.error.
      setSubmissionError('No se pudo reclamar esta identidad. Revisa el mensaje e inténtalo de nuevo.')
    }
  }

  const confirmDm = async () => {
    if (
      !identityClaimSelectionIsCurrent(selectedDm, claim)
      || !isClaimCurrent?.(
        selectedDm.candidate.playerId,
        selectedDm.candidate.role,
        selectedDm.context,
      )
    ) {
      setSelectedDm(null)
      setSubmissionError('La selección ya no está vigente. Elige una fila disponible de nuevo.')
      return
    }
    try {
      const claimed = await confirmIdentityClaim({
        selection: selectedDm,
        currentClaim: claim,
        isCurrent: (context, playerId, role) => isClaimCurrent(playerId, role, context),
        claim: (playerId, confirmedDm, context, role) => onClaim(playerId, confirmedDm, context, role),
      })
      if (!claimed) {
        setSelectedDm(null)
        setSubmissionError('La selección ya no está vigente. Elige una fila disponible de nuevo.')
      }
    } catch {
      if (
        !identityClaimSelectionIsCurrent(selectedDm, claim)
        || !isClaimCurrent?.(
          selectedDm.candidate.playerId,
          selectedDm.candidate.role,
          selectedDm.context,
        )
      ) {
        setSelectedDm(null)
        setSubmissionError('La selección ya no está vigente. Elige una fila disponible de nuevo.')
      } else {
        setSubmissionError('No se pudo reclamar esta identidad. Revisa el mensaje e inténtalo de nuevo.')
      }
    }
  }

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
        {selectedDm ? (
          <div className="identity-claim-confirm" aria-live="polite">
            <p>Vas a vincular esta fila:</p>
            <dl>
              <div><dt>Nombre</dt><dd>{selectedDm.candidate.playerName}</dd></div>
              <div><dt>Rol</dt><dd>Narrador</dd></div>
              <div><dt>Mesa</dt><dd>{claim.mesa.name}</dd></div>
            </dl>
            <p className="muted">Al confirmar, afirmas que eres el Narrador de esta mesa y que esta fila te pertenece; no es una prueba técnica de propiedad.</p>
            <div className="identity-claim-actions">
              <button type="button" className="primary" disabled={claim.busy} onClick={confirmDm}>
                Confirmar que soy el Narrador
              </button>
              <button type="button" className="ghost" disabled={claim.busy} onClick={() => cancelIdentityClaimSelection(setSelectedDm)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="identity-claim-list">
            {claim.candidates.map((candidate) => (
              <button
                type="button"
                className="ghost"
                key={candidate.playerId}
                disabled={claim.busy}
                onClick={() => {
                  setSubmissionError('')
                  chooseIdentityClaimCandidate(candidate, {
                    context: claim.context,
                    onSelectDm: setSelectedDm,
                    onClaim: (playerId, confirmedDm, context) => claimCandidate(
                      candidate,
                      confirmedDm,
                      context,
                      candidate.role,
                    ),
                  })
                }}
              >
                <span>{candidate.playerName}</span>
                <small>{candidate.role === 'dm' ? 'Narrador' : 'Jugador'}</small>
              </button>
            ))}
          </div>
        )}
        {claim.candidates.length === 0 ? (
          <p className="muted">No quedan miembros disponibles para vincular. Puede que otra cuenta los haya reclamado.</p>
        ) : null}
        <p className="hint">
          Solo reclama tu personaje. Es un vínculo por orden de llegada en una mesa privada y no demuestra por sí solo que la fila te pertenezca: confirma con el Narrador si tienes dudas. El primero en reclamar bloquea esa fila; para cambiar la asociación, pide ayuda al Narrador. Se conserva el nombre y los datos; el vínculo no cambia player_id.
        </p>
        {claim.error || submissionError ? <p className="hint bad" role="alert">{claim.error || submissionError}</p> : null}
        {claim.busy ? <p className="muted">Verificando y vinculando…</p> : null}
        {!selectedDm ? <button type="button" className="ghost" onClick={onDismiss} disabled={claim.busy}>Cancelar</button> : null}
      </section>
    </div>
  )
}
