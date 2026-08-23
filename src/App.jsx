import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import CharacterGate from './components/CharacterGate'
import ChroniclePanel from './components/ChroniclePanel'
import DicePanel from './components/DicePanel'
import DiscordOnly from './components/DiscordOnly'
import Help from './components/Help'
import MesaLobby from './components/MesaLobby'
import NameEdit from './components/NameEdit'
import NameGate from './components/NameGate'
import { useActivity } from './hooks/useActivity'
import { useGameLog } from './hooks/useGameLog'
import { useMembers } from './hooks/useMembers'
import { useMesaBackground } from './hooks/useMesaBackground'
import { useMesas } from './hooks/useMesas'
import { useMusic } from './hooks/useMusic'
import { useNpcs } from './hooks/useNpcs'
import { useSheet } from './hooks/useSheet'
import { uploadAvatar, uploadBackground, uploadPhoto, validAvatarFile } from './lib/avatar'
import { executeParsed, formatResultLine } from './lib/dice'
import { colorFromName, isLikelyEmbedded } from './lib/discord'
import { deleteMyData, renameMember, setMemberAvatar, setMesaBackground } from './lib/mesasApi'
import { hasSupabase } from './lib/supabase'
import { claimSeat, seatedFromMembers, seatedPlayers } from './lib/seats'
import { copyText } from './lib/clipboard'

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
  const archive = useMesas(persistOn, activity.identity)
  const [skipSave, setSkipSave] = useState(false)
  const [toast, setToast] = useState('')
  const [showDieLabels, setShowDieLabels] = useState(false)
  const [tab, setTab] = useState('log')
  const isMobile = useIsMobile()
  const [showTable, setShowTable] = useState(!isMobile)
  const [sheetTarget, setSheetTarget] = useState(null)
  const [panelW, setPanelW] = useState(380)
  const [dragging, setDragging] = useState(false)
  const mainRef = useRef(null)
  const [diceText, setDiceText] = useState('')

  const persist = persistOn && archive.current && !skipSave
    ? { enabled: true, mesaId: archive.current.id, sessionId: archive.current.currentSessionId }
    : { enabled: false }
  const roomId = persist.enabled ? `mesa-${persist.mesaId}` : activity.roomId
  const log = useGameLog(roomId, activity.identity, persist)
  const party = useMembers(persist.enabled ? persist.mesaId : '', activity.identity)
  const viewingPlayerId = sheetTarget || activity.identity?.id || ''
  const sheet = useSheet(persist.enabled ? persist.mesaId : '', viewingPlayerId)
  const npcs = useNpcs(persist.enabled ? persist.mesaId : '')
  const backgroundUrl = useMesaBackground(persist.enabled ? persist.mesaId : '')
  const viewingOtherPlayer = viewingPlayerId !== activity.identity?.id
    && party.members.some((m) => m.player_id === viewingPlayerId)
  const sheetReadOnly = Boolean(persist.enabled && party.isDm && viewingOtherPlayer)

  const players = useMemo(
    () => activity.mergePlayers(log.remotes),
    [activity.participants, activity.identity, log.remotes],
  )
  const seats = useMemo(
    () => (persist.enabled
      ? seatedFromMembers(party.members.map((m) => ({
        ...m,
        self: m.player_id === activity.identity?.id,
      })))
      : seatedPlayers(players)),
    [persist.enabled, party.members, players, activity.identity],
  )
  const setIdentity = activity.setIdentity
  const music = useMusic()

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
      .filter((e) => e.player?.id === activity.identity?.id)
      .map((e) => e.command)
    return [...new Set(mine.reverse())].slice(0, 20)
  }, [log.entries, activity.identity])

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
    || activity.identity?.id === dmId
    || log.remotes.some((r) => r.id === dmId)
    || participants.some((p) => p.id === dmId)
  const muted = Boolean(persist.enabled && party.me?.muted)
  const rollBlocked = muted
  // Solo se bloquea la mesa si hay evidencia positiva de ausencia del Narrador
  // (participantes del SDK no vacíos y el Narrador no está entre ellos).
  const waitingForDm = persist.enabled && Boolean(dmId)
    && activity.identity?.id !== dmId
    && participants.length > 0
    && !dmOnline

  const onRoll = async (parsed) => {
    const result = executeParsed(parsed)
    log.addEntry({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      player: charName ? { ...activity.identity, name: charName } : activity.identity,
      command: parsed.command,
      result,
      line: formatResultLine(result),
    })
  }

  const composeSheetRoll = (payload) => {
    if (!payload) {
      setDiceText('')
      return
    }
    const match = diceText.match(/(?:^|\s)(\d+)wod(\d+)(!?)/)
    const difficulty = match ? Number(match[2]) : 6
    const specialty = payload.specialty ?? (match ? Boolean(match[3]) : false)
    const description = payload.description ? ` ${payload.description}` : ''
    setDiceText(`/r ${payload.count}wod${difficulty}${specialty ? '!' : ''}${description}`)
  }

  const createNpc = async () => {
    try {
      const id = await npcs.create()
      setSheetTarget(id)
      setTab('ficha')
      flash('NPC creado')
    } catch (err) {
      flash(err.message || 'No se pudo crear el NPC')
    }
  }

  const deleteNpc = async (id) => {
    if (!window.confirm('¿Eliminar la ficha de este NPC?')) return
    try {
      await npcs.remove(id)
      if (sheetTarget === id) setSheetTarget(null)
      flash('NPC eliminado')
    } catch (err) {
      flash(err.message || 'No se pudo eliminar el NPC')
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
        await renameMember(persist.mesaId, activity.identity.id, name)
        log.renamePlayer(activity.identity.id, name)
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
    const url = await uploadAvatar(activity.identity.id, file)
    let photoUrl
    if (fullFile) {
      photoUrl = await uploadPhoto(activity.identity.id, fullFile)
    }
    activity.setIdentity({ ...activity.identity, avatar: url })
    log.setPlayerAvatar(activity.identity.id, url)
    if (persist.enabled) {
      try {
        await setMemberAvatar(persist.mesaId, activity.identity.id, url, photoUrl)
      } catch (err) {
        flash(err.message || 'La foto se subió pero no se guardó en la mesa')
      }
    }
    flash('Foto actualizada')
  }

  const setBackground = async (file) => {
    if (!file) return
    try {
      const url = await uploadBackground(persist.mesaId, file)
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

  if (!activity.identity) {
    return (
      <NameGate
        participants={activity.participants}
        identity={activity.identity}
        embedded={activity.embedded}
        onSubmit={activity.setIdentity}
      />
    )
  }

  if (persistOn && !archive.current && !skipSave) {
    return (
      <MesaLobby
        identity={activity.identity}
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
            await deleteMyData(activity.identity.id)
            localStorage.removeItem('diswod.identity')
            flash('Datos borrados')
            window.setTimeout(() => window.location.reload(), 600)
          } catch (err) {
            flash(err.message || 'No se pudieron borrar los datos')
          }
        }}
      />
    )
  }

  const taken = seats.filter(Boolean).length
  const localSeat = seats.findIndex((p) => p?.id === activity.identity.id)
  const mySeat = localSeat >= 0 ? localSeat : null

  if (waitingForDm) {
    return (
      <div className="waiting">
        <div className="veil" />
        <div className="waiting-card">
          <h2>Esperando al Narrador</h2>
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
          playerId={activity.identity.id}
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
          sheetReadOnly={sheetReadOnly}
          sheetTarget={sheetTarget}
          onSheetTarget={setSheetTarget}
          onSheetChange={sheet.update}
          onCompose={composeSheetRoll}
          diceText={diceText}
          rollDisabled={rollBlocked}
          npcs={npcs.npcs}
          onCreateNpc={createNpc}
          onDeleteNpc={deleteNpc}
          avatar={activity.identity?.avatar}
          onAvatar={changeAvatar}
          isOwn={viewingPlayerId === activity.identity?.id}
          backgroundUrl={backgroundUrl}
          onSetBackground={setBackground}
          onClearBackground={clearBackground}
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
            localId={activity.identity.id}
            localSeat={mySeat}
            showLabels={showDieLabels}
            backgroundUrl={backgroundUrl}
            onClose={isMobile ? () => setShowTable(false) : null}
          />
        </Suspense>
      </main>

      <DicePanel
        onRoll={onRoll}
        disabled={rollBlocked}
        reason={muted
          ? 'El Narrador te ha silenciado.'
          : ''}
        lastCommands={lastCommands}
        value={diceText}
        onChange={setDiceText}
      />
      {persist.enabled && archive.pendingCharName ? (
        <CharacterGate
          defaultName={activity.identity.name}
          onAccept={async (name) => {
            try {
              await renameMember(persist.mesaId, activity.identity.id, name)
              log.renamePlayer(activity.identity.id, name)
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
