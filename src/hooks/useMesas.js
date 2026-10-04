import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  codeFromLocation,
  createMesa,
  getMesa,
  getMesaByCode,
  joinByCode,
  listMembers,
  listMyMesas,
  mesaFromLocation,
  persistMesaParam,
  setMesaStatus,
} from '../lib/mesasApi'
import { cleanError } from '../lib/supabase'
import { bindMesaToPlayer, mesaForPlayer, mesaRequestIsCurrent } from '../lib/mesaContext'
import {
  availableLegacyCandidates,
  claimLegacyPlayer,
  getLegacyClaimCandidates,
  identityClaimContextMatches,
  identityWithMesaClaim,
  isVerifiedClaimIdentity,
} from '../lib/playerIdentityLinks'

export function useMesas(enabled, identity, accessToken = '', replaceIdentityLinks = () => identity) {
  const playerId = identity?.id || ''
  const [mesaList, setMesaList] = useState({ playerId: '', contextGeneration: -1, rows: [] })
  const [currentBinding, setCurrentBinding] = useState(null)
  const [loadingOwner, setLoadingOwner] = useState(null)
  const [errorOwner, setErrorOwner] = useState(null)
  const [pendingCharNameOwner, setPendingCharNameOwner] = useState(null)
  const [pendingClaim, setPendingClaim] = useState(null)
  const pendingClaimRef = useRef(null)
  const claimGeneration = useRef(0)
  const claimMesaId = useRef('')
  const listGeneration = useRef(0)
  const openGeneration = useRef(0)
  const contextGeneration = useRef(0)
  const currentPlayerId = useRef(playerId)
  const currentIdentity = useRef(identity)
  const previousPlayerId = useRef(playerId)
  const renderedPlayerId = useRef(playerId)

  const setClaimState = (next) => {
    pendingClaimRef.current = next
    setPendingClaim(next)
  }

  const isClaimContextCurrent = (context) => Boolean(
    identityClaimContextMatches(context, {
      mesaId: claimMesaId.current,
      discordUserId: currentPlayerId.current,
      generation: claimGeneration.current,
      contextGeneration: contextGeneration.current,
    })
    && enabled
  )

  useLayoutEffect(() => {
    if (renderedPlayerId.current !== playerId) {
      renderedPlayerId.current = playerId
      contextGeneration.current += 1
      listGeneration.current += 1
      openGeneration.current += 1
      claimGeneration.current += 1
      claimMesaId.current = ''
      pendingClaimRef.current = null
      setPendingClaim(null)
    }
    currentPlayerId.current = playerId
    currentIdentity.current = identity
  }, [playerId, identity])

  const mesas = enabled && playerId
    && mesaList.playerId === playerId
    && mesaList.contextGeneration === contextGeneration.current
    && mesaList.generation === listGeneration.current
    ? mesaList.rows
    : []
  const current = mesaForPlayer(currentBinding, playerId, enabled, contextGeneration.current)
  const effectiveId = current ? currentBinding.effectivePlayerId || playerId : playerId
  const loading = Boolean(
    enabled
    && playerId
    && loadingOwner?.playerId === playerId
    && loadingOwner.contextGeneration === contextGeneration.current
    && loadingOwner.generation === listGeneration.current,
  )
  const error = errorOwner?.playerId === playerId
    && errorOwner.contextGeneration === contextGeneration.current
    ? errorOwner.message
    : ''
  const pendingCharName = Boolean(
    pendingCharNameOwner?.value
    && pendingCharNameOwner.playerId === playerId
    && pendingCharNameOwner.contextGeneration === contextGeneration.current,
  )

  useEffect(() => {
    const previous = previousPlayerId.current
    if (previous && previous !== playerId) {
      setCurrentBinding(null)
      setPendingCharNameOwner(null)
      persistMesaParam('')
      claimGeneration.current += 1
      claimMesaId.current = ''
      setClaimState(null)
    }
    previousPlayerId.current = playerId
  }, [playerId])

  useEffect(() => {
    if (enabled) return
    claimGeneration.current += 1
    claimMesaId.current = ''
    setClaimState(null)
  }, [enabled])

  const refresh = useCallback(async () => {
    if (!enabled || !playerId || currentPlayerId.current !== playerId) return []

    const request = {
      playerId,
      generation: ++listGeneration.current,
      contextGeneration: contextGeneration.current,
    }
    setLoadingOwner(request)
    try {
      const rows = await listMyMesas(currentIdentity.current)
      if (!mesaRequestIsCurrent(
        request,
        currentPlayerId.current,
        listGeneration.current,
        contextGeneration.current,
      )) return []
      setMesaList({
        playerId: request.playerId,
        contextGeneration: request.contextGeneration,
        generation: request.generation,
        rows,
      })
      setErrorOwner({ ...request, message: '' })
      return rows
    } catch (err) {
      if (!mesaRequestIsCurrent(
        request,
        currentPlayerId.current,
        listGeneration.current,
        contextGeneration.current,
      )) return []
      setErrorOwner({ ...request, message: cleanError(err) })
      throw err
    } finally {
      if (mesaRequestIsCurrent(
        request,
        currentPlayerId.current,
        listGeneration.current,
        contextGeneration.current,
      )) {
        setLoadingOwner(null)
      }
    }
  }, [enabled, playerId])

  const openForPlayer = async (
    mesa,
    requestPlayerId,
    authorizedRows,
    expectedContextGeneration = contextGeneration.current,
    authorizedListGeneration = listGeneration.current,
    validate = null,
  ) => {
    if (!validate) {
      claimGeneration.current += 1
      claimMesaId.current = ''
      setClaimState(null)
    }
    if (!enabled || !requestPlayerId || currentPlayerId.current !== requestPlayerId) return null
    if (contextGeneration.current !== expectedContextGeneration) return null
    if (listGeneration.current !== authorizedListGeneration) return null
    if (!authorizedRows?.some((row) => row.id === mesa?.id)) return null

    const request = {
      playerId: requestPlayerId,
      generation: ++openGeneration.current,
      contextGeneration: expectedContextGeneration,
    }
    const fresh = await getMesa(mesa.id)
    if (validate && !validate()) return null
    if (!mesaRequestIsCurrent(
      request,
      currentPlayerId.current,
      openGeneration.current,
      contextGeneration.current,
    )) return null
    if (listGeneration.current !== authorizedListGeneration) return null
    if (!authorizedRows.some((row) => row.id === fresh.id)) return null

    const mesaIdentityId = fresh.myPlayerId
      || currentIdentity.current?.links?.find((link) => link.mesaId === fresh.id)?.playerId
      || requestPlayerId
    const binding = bindMesaToPlayer(fresh, requestPlayerId, expectedContextGeneration, mesaIdentityId)
    if (!binding) return null
    setCurrentBinding(binding)
    persistMesaParam(fresh.id)
    return fresh
  }

  const storeMesaLink = (mesaId, linkedPlayerId) => {
    const next = identityWithMesaClaim(currentIdentity.current, mesaId, linkedPlayerId)
    currentIdentity.current = replaceIdentityLinks(next.links) || next
    return currentIdentity.current
  }

  useEffect(() => {
    if (!enabled || !playerId) return undefined
    let active = true
    const requestPlayerId = playerId
    const requestContextGeneration = contextGeneration.current
    const requestIsActive = (requestListGeneration) => (
      active
      && currentPlayerId.current === requestPlayerId
      && contextGeneration.current === requestContextGeneration
      && listGeneration.current === requestListGeneration
    )
    const firstRefresh = refresh()
    let requestListGeneration = listGeneration.current

    firstRefresh
      .then(async (rows) => {
        if (!requestIsActive(requestListGeneration)) return
        const wanted = mesaFromLocation()
        const invite = codeFromLocation()
        let found = wanted ? rows.find((mesa) => mesa.id === wanted) : null
        if (wanted && !found) persistMesaParam('')

        if (!found && invite) {
          const joiningIdentity = currentIdentity.current
          if (!joiningIdentity || joiningIdentity.id !== requestPlayerId || !requestIsActive(requestListGeneration)) return
          const joined = await beginJoin(invite, joiningIdentity)
          if (!requestIsActive(requestListGeneration)) return
          if (joined?.cancelled) return
          if (joined?.pendingClaim) return
          found = joined.mesa
          if (joined.isNew) {
            setPendingCharNameOwner({
              playerId: requestPlayerId,
              contextGeneration: requestContextGeneration,
              value: true,
            })
          }
          const refreshed = refresh()
          requestListGeneration = listGeneration.current
          const refreshedRows = await refreshed
          if (!requestIsActive(requestListGeneration)) return
          found = refreshedRows.find((mesa) => mesa.id === joined.mesa.id) || null
          if (!found) return
          await openForPlayer(
            found,
            requestPlayerId,
            refreshedRows,
            requestContextGeneration,
            requestListGeneration,
          )
          return
        }

        if (found) {
          await openForPlayer(found, requestPlayerId, rows, requestContextGeneration, requestListGeneration)
        }
      })
      .catch((err) => {
        if (requestIsActive(requestListGeneration)) {
          setErrorOwner({
            playerId: requestPlayerId,
            contextGeneration: requestContextGeneration,
            message: cleanError(err),
          })
        }
      })

    return () => {
      active = false
    }
  }, [enabled, playerId, refresh, accessToken])

  const open = async (mesa) => {
    const authorizedRows = mesaList.playerId === playerId
      && mesaList.contextGeneration === contextGeneration.current
      && mesaList.generation === listGeneration.current
      ? mesaList.rows
      : []
    return openForPlayer(
      mesa,
      playerId,
      authorizedRows,
      contextGeneration.current,
      mesaList.generation,
    )
  }

  const close = () => {
    openGeneration.current += 1
    claimGeneration.current += 1
    claimMesaId.current = ''
    setClaimState(null)
    setCurrentBinding(null)
    setPendingCharNameOwner(null)
    persistMesaParam('')
  }

  const create = async (fields) => {
    const actingIdentity = currentIdentity.current
    const actingPlayerId = actingIdentity?.id
    const actingContextGeneration = contextGeneration.current
    if (!enabled || !actingPlayerId || currentPlayerId.current !== actingPlayerId) return null
    const mesa = await createMesa({ ...fields, identity: actingIdentity })
    if (currentPlayerId.current !== actingPlayerId || contextGeneration.current !== actingContextGeneration) return mesa
    const rows = await refresh()
    if (currentPlayerId.current === actingPlayerId && contextGeneration.current === actingContextGeneration) {
      await openForPlayer(mesa, actingPlayerId, rows, actingContextGeneration, listGeneration.current)
    }
    return mesa
  }

  const join = async (code) => {
    const actingIdentity = currentIdentity.current
    const actingPlayerId = actingIdentity?.id
    const actingContextGeneration = contextGeneration.current
    if (!enabled || !actingPlayerId || currentPlayerId.current !== actingPlayerId) return null
    try {
      const result = await beginJoin(code, actingIdentity)
      if (result?.cancelled) return null
      if (result?.pendingClaim) return result.mesa
      const { mesa, isNew } = result
      if (currentPlayerId.current !== actingPlayerId || contextGeneration.current !== actingContextGeneration) return mesa
      if (isNew) {
        setPendingCharNameOwner({
          playerId: actingPlayerId,
          contextGeneration: actingContextGeneration,
          value: true,
        })
      }
      const rows = await refresh()
      if (currentPlayerId.current === actingPlayerId && contextGeneration.current === actingContextGeneration) {
        await openForPlayer(mesa, actingPlayerId, rows, actingContextGeneration, listGeneration.current)
      }
      return mesa
    } catch (err) {
      throw new Error(cleanError(err))
    }
  }

  const beginJoin = async (code, actingIdentity) => {
    const generation = ++claimGeneration.current
    const discordUserId = actingIdentity?.id || ''
    const expectedContextGeneration = contextGeneration.current
    claimMesaId.current = ''
    setClaimState(null)
    const baseIsCurrent = () => (
      enabled
      && currentPlayerId.current === discordUserId
      && contextGeneration.current === expectedContextGeneration
      && claimGeneration.current === generation
    )
    const mesa = await getMesaByCode(code)
    if (!baseIsCurrent()) return { cancelled: true }
    if (!mesa) throw new Error('Código inválido')
    claimMesaId.current = mesa.id
    const context = { mesaId: mesa.id, discordUserId, contextGeneration: expectedContextGeneration, generation }
    const contextIsCurrent = () => isClaimContextCurrent(context)
    let candidates = []
    if (isVerifiedClaimIdentity(actingIdentity, accessToken)) {
      const result = await getLegacyClaimCandidates(accessToken, mesa.id, mesa.inviteCode)
      if (!contextIsCurrent()) return { cancelled: true }
      if (result.linkedPlayerId) {
        storeMesaLink(mesa.id, result.linkedPlayerId)
        const joined = await joinByCode(code, currentIdentity.current)
        if (!contextIsCurrent()) return { cancelled: true }
        return { ...joined, mesa: { ...joined.mesa, myPlayerId: result.linkedPlayerId } }
      }
      candidates = result.candidates
      if (candidates.length) {
        setClaimState({ mesa, candidates, directMember: result.directMember, context, error: '', busy: false })
        return { mesa, pendingClaim: true }
      }
    } else {
      const roster = await listMembers(mesa.id)
      if (!baseIsCurrent()) return { cancelled: true }
      candidates = availableLegacyCandidates(roster)
      if (candidates.length) {
        claimMesaId.current = ''
        throw new Error('Para reclamar una identidad de mesa necesitas iniciar sesión con OAuth de Discord; elegir un participante no verifica tu cuenta.')
      }
    }
    claimMesaId.current = ''
    if (!baseIsCurrent()) return { cancelled: true }
    const joined = await joinByCode(code, actingIdentity)
    if (!baseIsCurrent()) return { cancelled: true }
    return joined
  }

  const claimCandidate = async (playerId, confirmedDm = false) => {
    const pending = pendingClaimRef.current
    const context = pending?.context
    const actingIdentity = currentIdentity.current
    if (!pending || !isClaimContextCurrent(context) || !isVerifiedClaimIdentity(actingIdentity, accessToken)) {
      throw new Error('Se requiere una cuenta de Discord verificada para reclamar esta identidad.')
    }
    setClaimState({ ...pending, busy: true, error: '' })
    try {
      const claimedPlayerId = await claimLegacyPlayer(
        accessToken,
        pending.mesa.id,
        playerId,
        pending.mesa.inviteCode,
        confirmedDm,
      )
      if (!isClaimContextCurrent(context)) return
      storeMesaLink(pending.mesa.id, claimedPlayerId)
      if (!isClaimContextCurrent(context)) return
      const joined = await joinByCode(pending.mesa.inviteCode, currentIdentity.current)
      if (!isClaimContextCurrent(context)) return
      const rows = await refresh()
      if (!isClaimContextCurrent(context)) return
      const mesaRow = rows.find((row) => row.id === pending.mesa.id)
        || { ...joined.mesa, myPlayerId: claimedPlayerId }
      setClaimState(null)
      await openForPlayer(
        { ...mesaRow, myPlayerId: claimedPlayerId },
        actingIdentity.id,
        [...rows.filter((row) => row.id !== pending.mesa.id), { ...mesaRow, myPlayerId: claimedPlayerId }],
        context.contextGeneration,
        listGeneration.current,
        contextIsCurrent,
      )
    } catch (error) {
      if (!isClaimContextCurrent(context)) return
      if (error.code === 'CLAIM_CONFLICT') {
        try {
          const refreshed = await getLegacyClaimCandidates(accessToken, pending.mesa.id, pending.mesa.inviteCode)
          if (!isClaimContextCurrent(context)) return
          if (refreshed.linkedPlayerId) {
            storeMesaLink(pending.mesa.id, refreshed.linkedPlayerId)
            if (!isClaimContextCurrent(context)) return
            setClaimState(null)
            const rows = await refresh()
            if (!isClaimContextCurrent(context)) return
            const mesaRow = rows.find((row) => row.id === pending.mesa.id)
            if (mesaRow) await openForPlayer(mesaRow, actingIdentity.id, rows, context.contextGeneration, listGeneration.current, contextIsCurrent)
            return
          }
          setClaimState({ ...pending, candidates: refreshed.candidates, directMember: refreshed.directMember, error: error.message, busy: false })
        } catch {
          if (isClaimContextCurrent(context)) setClaimState({ ...pending, candidates: [], error: error.message, busy: false })
        }
      } else {
        setClaimState({ ...pending, error: error.message || 'No se pudo reclamar la identidad.', busy: false })
      }
      throw error
    }
  }

  const continueWithDirectMember = async () => {
    const pending = pendingClaimRef.current
    const context = pending?.context
    if (!pending?.directMember || !isClaimContextCurrent(context)) return
    const joined = await joinByCode(pending.mesa.inviteCode, currentIdentity.current)
    if (!isClaimContextCurrent(context)) return
    const rows = await refresh()
    if (!isClaimContextCurrent(context)) return
    setClaimState(null)
    await openForPlayer(
      rows.find((row) => row.id === pending.mesa.id) || joined.mesa,
      context.discordUserId,
      rows,
      context.contextGeneration,
      listGeneration.current,
      () => isClaimContextCurrent(context),
    )
  }

  const archive = async (mesa) => {
    const actingPlayerId = playerId
    const actingContextGeneration = contextGeneration.current
    if (!current || current.id !== mesa.id || !actingPlayerId) return
    await setMesaStatus(mesa.id, 'archived')
    if (currentPlayerId.current !== actingPlayerId || contextGeneration.current !== actingContextGeneration) return
    await refresh()
    if (
      currentPlayerId.current === actingPlayerId
      && contextGeneration.current === actingContextGeneration
      && current?.id === mesa.id
    ) close()
  }

  const reopen = async (mesa) => {
    const actingPlayerId = playerId
    const actingContextGeneration = contextGeneration.current
    if (!actingPlayerId || !mesas.some((row) => row.id === mesa.id)) return
    const next = await setMesaStatus(mesa.id, 'active')
    if (currentPlayerId.current !== actingPlayerId || contextGeneration.current !== actingContextGeneration) return
    const rows = await refresh()
    if (currentPlayerId.current === actingPlayerId && contextGeneration.current === actingContextGeneration) {
      await openForPlayer(next, actingPlayerId, rows, actingContextGeneration, listGeneration.current)
    }
  }

  return {
    mesas,
    current,
    effectivePlayerId: effectiveId,
    identityLinks: currentIdentity.current?.links || identity?.links || [],
    loading,
    error,
    setError: (message) => setErrorOwner({
      playerId,
      contextGeneration: contextGeneration.current,
      message,
    }),
    pendingCharName,
    pendingClaim,
    claimCandidate,
    continueWithDirectMember,
    dismissClaim: () => {
      claimGeneration.current += 1
      claimMesaId.current = ''
      setClaimState(null)
    },
    dismissCharName: () => setPendingCharNameOwner(null),
    refresh,
    open,
    close,
    create,
    join,
    archive,
    reopen,
  }
}
