import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import CharacterGate from './components/CharacterGate'
import ChroniclePanel from './components/ChroniclePanel'
import DicePanel from './components/DicePanel'
import DiscordOnly from './components/DiscordOnly'
import Help from './components/Help'
import IdentityStatus from './components/IdentityStatus'
import MesaLobby from './components/MesaLobby'
import NameEdit from './components/NameEdit'
import NameGate from './components/NameGate'
import PlayerIdentityClaim from './components/PlayerIdentityClaim'
import { useActivity } from './hooks/useActivity'
import { useGameLog } from './hooks/useGameLog'
import { useMembers } from './hooks/useMembers'
import { useMesaBackground } from './hooks/useMesaBackground'
import { useMesas } from './hooks/useMesas'
import { useMusic } from './hooks/useMusic'
import { useScene } from './hooks/useScene'
import { useNpcs } from './hooks/useNpcs'
import { useSheet } from './hooks/useSheet'
import { uploadAvatar, uploadBackground, uploadPhoto, validAvatarFile } from './lib/avatar'
import { executeParsed, formatResultLine } from './lib/dice'
import { colorFromName, isLikelyEmbedded } from './lib/discord'
import { deleteMyData, renameMember, setMemberAvatar, setMesaBackground } from './lib/mesasApi'
import { proxiedUrl } from './lib/supabase'
import { hasSupabase } from './lib/supabase'
import { claimSeat, seatedFromMembers, seatedPlayers } from './lib/seats'
import { copyText } from './lib/clipboard'
import { canEditSheetTarget, canViewSheetTarget, isRosterReadyForMesa } from './lib/sheetAccess'
import { deleteNpcAfterSaving } from './lib/sheetQueue'
import { identityForMesaAccess } from './lib/activityIdentity'
import { canUsePersistentIdentity } from './lib/playerIdentityLinks'
import { createQuickRollOrigin, quickRollOriginMatches, reconcileQuickRollOrigin } from './lib/quickRolls'

function useIsMobile(bp = 800) {
  const [m, setM] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(`(max-width: ${bp}px)`).matches
  })
  useEffect(() => {
    const q = window.matchMedia(`(max-width: ${bp}px)`)
    const fn = (e) => setM(e.matches)
    q.addEventListener('change', fn)
    return () => q.removeEventListener('change', fn)
  }, [bp])
  return m
}

const Table3D = lazy(() => import('./components/Table3D'))

export default function App() {
  const activity = useActivity()
  const persistOn = hasSupabase()
  const persistentIdentityAllowed = canUsePersistentIdentity(activity.identity, activity.embedded)
  const archive = useMesas(
    persistOn && activity.identityLinksReady && persistentIdentityAllowed,
    identityForMesaAccess(activity.identity, activity.status),
    activity.oauthAccessToken,
    activity.replaceIdentityLinks,
  )
  const effectiveId = archive.effectivePlayerId || activity.identity?.id || ''
  const mesaIdentity = activity.identity ? { ...activity.identity, id: effectiveId } : null
  const [skipSave, setSkipSave] = useState(false)
  const [toast, setToast] = useState('')
  const [showDieLabels, setShowDieLabels] = useState(false)
  const [tab, setTab] = useState('log')
  const isMobile = useIsMobile()
  const [showTable, setShowTable] = useState(!isMobile)
  const [sheetTarget, setSheetTarget] = useState(null)
  const [sheetTargetMesaId, setSheetTargetMesaId] = useState(null)
  const deletingNpcIds = useRef(new Set())
  const [deletingNpcId, setDeletingNpcId] = useState(null)
  const [panelW, setPanelW] = useState(380)
  const [dragging, setDragging] = useState(false)
  const mainRef = useRef(null)
  const [diceText, setDiceText] = useState('')
  const quickRollOriginRef = useRef(null)

  const persist = persistOn && archive.current && !skipSave
    ? { enabled: true, mesaId: archive.current.id, sessionId: archive.current.currentSessionId }
    : { enabled: false }
  const roomId = persist.enabled ? `mesa-${persist.mesaId}` : activity.roomId
  const log = useGameLog(roomId, mesaIdentity, persist, {
    status: activity.status,
    embedded: activity.embedded,
  })
  const party = useMembers(persist.enabled ? persist.mesaId : '', mesaIdentity)
  const npcs = useNpcs(persist.enabled ? persist.mesaId : '')
  const backgroundUrl = useMesaBackground(persist.enabled ? persist.mesaId : '')
  const currentMesaId = persist.enabled ? persist.mesaId : ''
  const scene = useScene(currentMesaId, activity.oauthAccessToken, effectiveId, activity.identity?.source, activity.embedded)
  const rosterCurrent = isRosterReadyForMesa(party, currentMesaId)
  const npcRosterCurrent = isRosterReadyForMesa(npcs, currentMesaId)
  const memberIds = rosterCurrent ? party.members.map((member) => member.player_id) : []
  const npcIds = npcRosterCurrent ? npcs.npcs.map((npc) => npc.player_id) : []
  const activeSheetTarget = Boolean(sheetTarget && canViewSheetTarget({
    mesaId: currentMesaId,
    targetMesaId: sheetTargetMesaId,
    isDm: rosterCurrent && party.isDm,
    memberIds,
    npcIds: npcIds.includes(sheetTarget) || npcs.contains(sheetTarget)
      ? [...npcIds, sheetTarget]
      : npcIds,
  }, sheetTarget))
    ? sheetTarget
    : null
  const viewingPlayerId = activeSheetTarget || effectiveId
  const authorizeSheetEdit = (targetMesaId, targetPlayerId) => {
    const npcIsCurrent = npcs.contains(targetPlayerId)
    const authorizedNpcIds = npcIds.includes(targetPlayerId) || npcIsCurrent
      ? [...npcIds, targetPlayerId]
      : npcIds
    return canEditSheetTarget({
      mesaId: currentMesaId,
      targetMesaId,
      identityId: effectiveId,
      isDm: rosterCurrent && party.isDm,
      memberIds,
      npcIds: authorizedNpcIds,
    }, targetPlayerId)
      && (!String(targetPlayerId).startsWith('npc-') || npcIsCurrent)
  }
  const sheetCanEdit = authorizeSheetEdit(persist.enabled ? persist.mesaId : '', viewingPlayerId)
  const sheet = useSheet(
    persist.enabled ? persist.mesaId : '',
    viewingPlayerId,
    authorizeSheetEdit,
  )
  const sheetReadOnly = Boolean(persist.enabled && (!sheetCanEdit || deletingNpcId === viewingPlayerId))
  const quickRollTarget = {
    mesaId: currentMesaId,
    playerId: viewingPlayerId,
    ready: sheet.ready && !sheet.error,
  }
  const staleQuickRoll = quickRollOriginRef.current
    && !quickRollOriginMatches(quickRollOriginRef.current, quickRollTarget, diceText)

  useEffect(() => {
    const reconciled = reconcileQuickRollOrigin(quickRollOriginRef.current, quickRollTarget, diceText)
    if (!reconciled.invalidated) return
    quickRollOriginRef.current = reconciled.origin
    if (reconciled.text !== diceText) setDiceText(reconciled.text)
  }, [currentMesaId, viewingPlayerId, sheet.ready, sheet.error, diceText])

  const selectSheetTarget = (playerId) => {
    if (!playerId) {
      setSheetTarget(null)
      setSheetTargetMesaId(null)
      return
    }
    if (!persist.enabled || !rosterCurrent || !party.isDm || deletingNpcIds.current.has(playerId)) return
    const isOtherMember = memberIds.includes(playerId) && playerId !== effectiveId
    const isCurrentNpc = npcs.contains(playerId)
    if (!isOtherMember && !isCurrentNpc) return
    setSheetTarget(playerId)
    setSheetTargetMesaId(persist.mesaId)
  }

  useEffect(() => {
    if (!sheetTarget) return
    const mesaChanged = !persist.enabled || sheetTargetMesaId !== persist.mesaId
    const accessRevoked = rosterCurrent && !activeSheetTarget
    if (mesaChanged || accessRevoked) {
      setSheetTarget(null)
      setSheetTargetMesaId(null)
    }
  }, [sheetTarget, sheetTargetMesaId, persist.enabled, persist.mesaId, rosterCurrent, activeSheetTarget])

  const players = useMemo(
    () => activity.mergePlayers(log.remotes),
    [activity.participants, activity.identity, log.remotes],
  )
  const seats = useMemo(
    () => (persist.enabled
      ? seatedFromMembers(party.members.map((m) => ({
        ...m,
        self: m.player_id === effectiveId,
      })))
      : seatedPlayers(players)),
    [persist.enabled, party.members, players, activity.identity],
  )
  const setIdentity = activity.setIdentity
  const music = useMusic(scene.music, {
    persisted: Boolean(currentMesaId),
    sceneReady: scene.ready,
    contextKey: `${currentMesaId}:${effectiveId}`,
  })

  useEffect(() => {
    if (persist.enabled) return
    const me = activity.identity
    if (!me) return
    const next = claimSeat(me, log.remotes)
    if (next !== me.seat) setIdentity({ ...me, seat: next })
  }, [activity.identity, log.remotes, setIdentity, persist.enabled])

  useEffect(() => {
    if (!party.kicked) return
    archive.close()
    setTab('log')
    setToast('Te han expulsado de la mesa')
    window.setTimeout(() => setToast(''), 1800)
  }, [party.kicked])

  useEffect(() => {
    if (!dragging) return undefined
    const move = (event) => {
      const main = mainRef.current
      if (!main) return
      const rect = main.getBoundingClientRect()
      const next = Math.min(Math.max(event.clientX - rect.left, 260), rect.width - 300)
      setPanelW(next)
    }
    const up = () => setDragging(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [dragging])

  const lastCommands = useMemo(() => {
    const mine = log.entries
      .filter((e) => e.player?.id === effectiveId)
      .map((e) => e.command)
    return [...new Set(mine.reverse())].slice(0, 20)
  }, [log.entries, effectiveId])

  const flash = (text) => {
    setToast(text)
    window.setTimeout(() => setToast(''), 1800)
  }

  const charName = persist.enabled ? party.me?.name || activity.identity?.name : activity.identity?.name

  const dmId = persist.enabled
    ? party.members.find((m) => m.role === 'dm')?.player_id || archive.current?.dmId
    : ''
  const participants = activity.participants || []
  const dmOnline = !persist.enabled || !dmId
    || effectiveId === dmId
    || log.remotes.some((r) => r.id === dmId)
    || participants.some((p) => p.id === dmId)
  const muted = Boolean(persist.enabled && party.me?.muted)
  const rollBlocked = muted
  // Solo se bloquea la mesa si hay evidencia positiva de ausencia del Narrador
  // (participantes del SDK no vacíos y el Narrador no está entre ellos).
  const waitingForDm = persist.enabled && Boolean(dmId)
    && effectiveId !== dmId
    && participants.length > 0
    && !dmOnline

  const onRoll = async (parsed) => {
    const result = executeParsed(parsed)
    log.addEntry({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      player: charName ? { ...mesaIdentity, name: charName } : mesaIdentity,
      command: parsed.command,
      result,
      line: formatResultLine(result),
    })
  }

  const setSheetGeneratedRoll = (command) => {
    if (!quickRollTarget.ready) return
    quickRollOriginRef.current = createQuickRollOrigin({
      mesaId: quickRollTarget.mesaId,
      playerId: quickRollTarget.playerId,
      text: command,
    })
    setDiceText(command)
  }

  const onDiceTextChange = (text) => {
    quickRollOriginRef.current = null
    setDiceText(text)
  }

  const composeSheetRoll = (payload) => {
    if (!payload) {
      quickRollOriginRef.current = null
      setDiceText('')
      return
    }
    if (payload.command) {
      setSheetGeneratedRoll(payload.command)
      return
    }
    const match = diceText.match(/(?:^|\s)(\d+)wod(\d+)(!?)/)
    const difficulty = match ? Number(match[2]) : 6
    const specialty = payload.specialty ?? (match ? Boolean(match[3]) : false)
    const description = payload.description ? ` ${payload.description}` : ''
    setSheetGeneratedRoll(`/r ${payload.count}wod${difficulty}${specialty ? '!' : ''}${description}`)
  }

  const createNpc = async () => {
    if (!persist.enabled || !rosterCurrent || !party.isDm || !npcRosterCurrent) return
    try {
      const id = await npcs.create()
      selectSheetTarget(id)
      setTab('ficha')
      flash('NPC creado')
    } catch (err) {
      flash(err.message || 'No se pudo crear el NPC')
    }
  }

  const deleteNpc = async (id) => {
    if (!persist.enabled || !rosterCurrent || !party.isDm || !npcRosterCurrent || !npcs.contains(id)) return
    if (!window.confirm('¿Eliminar la ficha de este NPC?')) return
    deletingNpcIds.current.add(id)
    sheet.lockEdits(persist.mesaId, id, true)
    setDeletingNpcId(id)
    try {
      const deleted = await deleteNpcAfterSaving({
        flushPending: () => sheet.flushPending(persist.mesaId, id),
        cancelPending: () => sheet.cancelPending(persist.mesaId, id),
        remove: () => npcs.remove(id),
      })
      if (!deleted) {
        flash('No se eliminó el NPC: no se pudo guardar el borrador. La ficha sigue disponible.')
        return
      }
      if (sheetTarget === id) selectSheetTarget(null)
      flash('NPC eliminado')
    } catch (err) {
      flash(`No se eliminó el NPC; el borrador quedó guardado. ${err.message || 'Revisa la conexión e inténtalo de nuevo.'}`)
    } finally {
      deletingNpcIds.current.delete(id)
      sheet.lockEdits(persist.mesaId, id, false)
      setDeletingNpcId(null)
    }
  }

  const leaveTable = async () => {
    await party.leave()
    archive.close()
    setTab('log')
    flash('Has salido de la mesa')
  }

  const renameSelf = async (name) => {
    if (persist.enabled) {
      try {
        await renameMember(persist.mesaId, effectiveId, name)
        log.renamePlayer(effectiveId, name)
        flash('Nombre actualizado')
      } catch (err) {
        flash(err.message || 'No se pudo actualizar el nombre en la mesa')
      }
      return
    }
    const next = { ...activity.identity, name, color: colorFromName(name) }
    activity.setIdentity(next)
    log.renamePlayer(next.id, name)
  }

  const changeAvatar = async (file, fullFile) => {
    const invalid = validAvatarFile(file)
    if (invalid) throw new Error(invalid)
    const url = proxiedUrl(await uploadAvatar(persist.mesaId, effectiveId, file))
    let photoUrl
    if (fullFile) {
      photoUrl = proxiedUrl(await uploadPhoto(persist.mesaId, effectiveId, fullFile))
    }
    activity.setIdentity({ ...activity.identity, avatar: url })
    log.setPlayerAvatar(effectiveId, url)
    if (persist.enabled) {
      try {
        await setMemberAvatar(persist.mesaId, effectiveId, url, photoUrl)
      } catch (err) {
        flash(err.message || 'La foto se subió pero no se guardó en la mesa')
      }
    }
    flash('Foto actualizada')
  }

  const setBackground = async (file) => {
    if (!file) return
    try {
      const url = proxiedUrl(await uploadBackground(persist.mesaId, file))
      await setMesaBackground(persist.mesaId, url)
      flash('Fondo de mesa actualizado')
    } catch (err) {
      flash(err.message || 'No se pudo subir el fondo')
    }
  }

  const clearBackground = async () => {
    try {
      await setMesaBackground(persist.mesaId, '')
      flash('Fondo de mesa quitado')
    } catch (err) {
      flash(err.message || 'No se pudo quitar el fondo')
    }
  }

  if (!isLikelyEmbedded() && !import.meta.env.DEV && import.meta.env.VITE_ALLOW_WEB !== '1') {
    return <DiscordOnly />
  }

  if (activity.status === 'boot') {
    return <div className="gate"><p className="gate-copy">Conectando con Discord…</p></div>
  }

  if (activity.identity?.source === 'discord-auth' && !activity.identityLinksReady) {
    return <div className="gate"><p className="gate-copy">Comprobando tus vínculos de mesa…</p></div>
  }

  if (activity.embedded && activity.status === 'activity-error') {
    return (
      <div className="gate">
        <div className="gate-card">
          <p className="eyebrow">Discord Activity</p>
          <h1>No se pudo conectar</h1>
          <p className="gate-copy">{activity.error || 'Vuelve a abrir la Activity e inténtalo de nuevo.'}</p>
          {activity.diagnosticMessage && activity.diagnosticMessage !== activity.error && (
            <p className="gate-copy" role="status">{activity.diagnosticMessage}</p>
          )}
          <button type="button" className="primary" onClick={activity.retry}>Reintentar</button>
        </div>
      </div>
    )
  }

  if (activity.embedded && !activity.identity && !activity.fallbackReady) {
    return <div className="gate"><p className="gate-copy">Obteniendo participantes de Discord…</p></div>
  }

  if (!activity.identity) {
    return (
      <NameGate
        participants={activity.participants}
        identity={activity.identity}
        embedded={activity.embedded}
        diagnosticMessage={activity.diagnosticMessage}
        onSubmit={activity.setIdentity}
      />
    )
  }

  if (persistOn && !archive.current && !skipSave) {
    return (
      <>
        <MesaLobby
          identity={activity.identity}
          identityMode={activity.status}
          presenceStatus={activity.presenceStatus}
          persistentIdentityBlocked={!persistentIdentityAllowed}
          mesas={archive.mesas}
          loading={archive.loading}
          error={archive.error}
          onOpen={archive.open}
          onCreate={archive.create}
          onJoin={archive.join}
          onArchive={archive.archive}
          onReopen={archive.reopen}
          onSkip={() => setSkipSave(true)}
          onErase={async () => {
            if (!window.confirm('¿Borrar tus notas, pizarra y mesas? Las tiradas quedarán anónimas.')) return
            try {
              await deleteMyData({ ...activity.identity, links: archive.identityLinks })
              localStorage.removeItem('diswod.identity')
              flash('Datos borrados')
              window.setTimeout(() => window.location.reload(), 600)
            } catch (err) {
              flash(err.message || 'No se pudieron borrar los datos')
            }
          }}
        />
        <PlayerIdentityClaim
          claim={archive.pendingClaim}
          onClaim={archive.claimCandidate}
          onContinueDirect={archive.continueWithDirectMember}
          onDismiss={archive.dismissClaim}
        />
      </>
    )
  }

  const taken = seats.filter(Boolean).length
  const localSeat = seats.findIndex((p) => p?.id === effectiveId)
  const mySeat = localSeat >= 0 ? localSeat : null

  if (waitingForDm) {
    return (
      <div className="waiting">
        <div className="veil" />
        <div className="waiting-card">
          <h2>Esperando al Narrador</h2>
          <IdentityStatus
            identity={activity.identity}
            mode={activity.status}
            presenceStatus={activity.presenceStatus}
          />
          <p>La mesa solo está disponible cuando el Narrador está presente.</p>
          <button type="button" className="ghost" onClick={leaveTable}>Salir de la mesa</button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="veil" />
      <header className="topbar">
        <div className="brand">
          <span className="mark">✝</span>
          <div>
            <h1>Diswod</h1>
            <p>{archive.current ? archive.current.name : 'Vampiro: la Mascarada · V20'}</p>
          </div>
        </div>
        <div className="top-actions">
          <span className="occupancy">{taken}/4 en mesa</span>
          <IdentityStatus
            identity={activity.identity}
            mode={activity.status}
            presenceStatus={activity.presenceStatus}
          />
          {persist.enabled && !party.isPlayer ? <span className="occupancy">Visitante</span> : null}
          {persistOn ? (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setSkipSave(false)
                archive.close()
                setTab('log')
              }}
            >
              Mesas
            </button>
          ) : null}
          {!persist.enabled ? (
            <button
              type="button"
              className="room"
              onClick={async () => {
                const ok = await copyText(window.location.href)
                flash(ok ? 'Enlace copiado' : 'No se pudo copiar')
              }}
            >
              Sala {activity.roomId}
            </button>
          ) : null}
          {persist.enabled && archive.current?.inviteCode ? (
            <button
              type="button"
              className="ghost invite"
              title="Copiar código de invitación"
              onClick={async () => {
                const ok = await copyText(archive.current.inviteCode)
                flash(ok ? 'Código copiado' : 'No se pudo copiar')
              }}
            >
              Código {archive.current.inviteCode}
            </button>
          ) : null}
          <button
            type="button"
            className={showDieLabels ? 'ghost is-on' : 'ghost'}
            onClick={() => setShowDieLabels((v) => !v)}
          >
            Números {showDieLabels ? 'ON' : 'OFF'}
          </button>
          {music.ready ? (
            <button
              type="button"
              className={music.muted ? 'ghost' : 'ghost is-on'}
              onClick={music.toggleMuted}
              title={music.muted ? 'Activar música de fondo' : 'Silenciar música de fondo'}
            >
              ♪ Música {music.muted ? 'OFF' : 'ON'}
            </button>
          ) : null}
          <NameEdit name={charName} avatar={activity.identity?.avatar} onRename={renameSelf} onAvatar={changeAvatar} />
          <button
            type="button"
            className={showTable ? 'ghost is-on' : 'ghost'}
            onClick={() => setShowTable((v) => !v)}
          >
            Mesa 3D
          </button>
          <Help />
        </div>
      </header>

      <main
        ref={mainRef}
        className={`${showTable ? '' : 'table-closed'}${dragging ? ' is-dragging' : ''}${isMobile && showTable ? ' mobile-table' : ''}`}
        style={isMobile
          ? { gridTemplateColumns: '1fr' }
          : showTable
            ? { gridTemplateColumns: `${panelW}px 10px 1fr` }
            : undefined}
      >
        <ChroniclePanel
          tab={tab}
          onTab={setTab}
          entries={log.entries}
          onCopy={(ok) => flash(ok ? 'Historial copiado' : 'No se pudo copiar')}
          persist={persist.enabled ? persist : null}
          playerId={effectiveId}
          mesa={archive.current}
          members={party.members}
          me={party.me}
          isDm={party.isDm}
          onSetRole={async (id, role) => {
            try {
              await party.setRole(id, role)
            } catch (err) {
              flash(err.message || 'No se pudo cambiar el rol')
            }
          }}
          onSetMuted={async (id, mutedFlag) => {
            try {
              await party.setMuted(id, mutedFlag)
              flash(mutedFlag ? 'Jugador silenciado' : 'Jugador activado')
            } catch (err) {
              flash(err.message || 'No se pudo silenciar al jugador')
            }
          }}
          onKick={async (id) => {
            await party.kick(id)
            flash('Jugador expulsado')
          }}
          onLeave={leaveTable}
          onCopyCode={async (code) => {
            const ok = await copyText(code)
            flash(ok ? 'Código copiado' : 'No se pudo copiar')
          }}
          sheet={sheet.data}
          sheetStatus={sheet.status}
          sheetReady={sheet.ready}
          sheetError={sheet.error}
          onRetrySheet={sheet.retryLoad}
          onRetrySheetSave={sheet.retrySave}
          sheetReadOnly={sheetReadOnly}
          sheetTarget={sheetTarget}
          onSheetTarget={selectSheetTarget}
          sheetTargetReady={rosterCurrent}
          npcTargetReady={npcRosterCurrent}
          onSheetChange={sheet.update}
          onCompose={composeSheetRoll}
          diceText={diceText}
          rollDisabled={rollBlocked}
          npcs={npcs.npcs}
          onCreateNpc={createNpc}
          onDeleteNpc={deleteNpc}
          avatar={activity.identity?.avatar}
          onAvatar={changeAvatar}
          isOwn={viewingPlayerId === effectiveId}
          backgroundUrl={backgroundUrl}
          onSetBackground={setBackground}
          onClearBackground={clearBackground}
          scene={scene}
          musicPlayback={music}
          onSceneMusic={async (mode, trackId) => {
            try {
              const applied = await scene.setMusic(mode, trackId)
              if (applied) flash('Música de escena actualizada')
            } catch {
              // The specific error and retry action are shown in ScenePanel.
            }
          }}
          onSceneFrenzy={async (playerId, active) => {
            try {
              const applied = await scene.setFrenzy(playerId, active)
              if (applied) flash(active ? 'Frenesí activado' : 'Frenesí quitado')
            } catch {
              // The specific error and retry action are shown in ScenePanel.
            }
          }}
        />
        {showTable && !isMobile ? (
          <div
            className={dragging ? 'splitter is-dragging' : 'splitter'}
            onPointerDown={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            title="Arrastra para redimensionar"
          />
        ) : null}
        <Suspense fallback={<div className="table-stage" />}>
          <Table3D
            seats={seats}
            entries={log.entries}
            localId={effectiveId}
            localSeat={mySeat}
            showLabels={showDieLabels}
            backgroundUrl={backgroundUrl}
            onClose={isMobile ? () => setShowTable(false) : null}
          />
        </Suspense>
      </main>

      <DicePanel
        onRoll={onRoll}
        disabled={rollBlocked || Boolean(staleQuickRoll)}
        reason={staleQuickRoll
          ? 'La ficha cambió o aún no está cargada; edita el comando o prepara otra tirada.'
          : muted ? 'El Narrador te ha silenciado.' : ''}
        lastCommands={lastCommands}
        value={diceText}
        onChange={onDiceTextChange}
      />
      {persist.enabled && archive.pendingCharName ? (
        <CharacterGate
          defaultName={activity.identity.name}
          onAccept={async (name) => {
            try {
              await renameMember(persist.mesaId, effectiveId, name)
              log.renamePlayer(effectiveId, name)
              archive.dismissCharName()
              setTab('ficha')
              flash(`Bienvenido, ${name}`)
            } catch (err) {
              flash(err.message || 'No se pudo guardar el nombre')
            }
          }}
          onDismiss={archive.dismissCharName}
        />
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
