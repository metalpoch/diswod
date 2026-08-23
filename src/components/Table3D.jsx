import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Die3D from './Die3D'
import { feltTexture, planDice, woodTexture } from '../lib/dice3d'
import { SEATS } from '../lib/seats'
import Avatar from './Avatar'

function Backdrop({ url }) {
  const { scene, size } = useThree()
  useEffect(() => {
    if (!url) {
      scene.background = new THREE.Color('#070303')
      return undefined
    }
    let active = true
    const loader = new THREE.TextureLoader()
    loader.load(url, (texture) => {
      if (!active) return
      texture.colorSpace = THREE.SRGBColorSpace
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      const imgAspect = (texture.image?.width || 1) / (texture.image?.height || 1)
      const screenAspect = size.width > 0 ? size.width / size.height : 1
      if (imgAspect > screenAspect) {
        texture.repeat.set(screenAspect / imgAspect, 1)
      } else {
        texture.repeat.set(1, imgAspect / screenAspect)
      }
      texture.offset.set((1 - texture.repeat.x) / 2, (1 - texture.repeat.y) / 2)
      texture.needsUpdate = true
      scene.background = texture
    })
    return () => {
      active = false
      scene.background = new THREE.Color('#070303')
    }
  }, [url, scene, size.width, size.height])
  return null
}

function Candle({ position, phase }) {
  const light = useRef()
  useFrame(({ clock }) => {
    if (!light.current) return
    light.current.intensity = 0.55 + Math.sin(clock.elapsedTime * 7 + phase) * 0.12
  })
  return (
    <group position={position}>
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.045, 0.36, 10]} />
        <meshStandardMaterial color="#efe6d2" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshBasicMaterial color="#ffb347" />
      </mesh>
      <pointLight
        ref={light}
        position={[0, 0.46, 0]}
        color="#ffb066"
        intensity={0.6}
        distance={4.5}
        decay={2}
      />
    </group>
  )
}

function Furniture() {
  const wood = useMemo(() => woodTexture(), [])
  const felt = useMemo(() => feltTexture(), [])
  return (
    <group>
      <mesh position={[0, -0.28, 0]} receiveShadow>
        <boxGeometry args={[7.35, 0.42, 4.55]} />
        <meshStandardMaterial map={wood} roughness={0.65} metalness={0.05} />
      </mesh>
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[7.7, 0.08, 4.9]} />
        <meshStandardMaterial color="#c9a227" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[7.05, 4.25]} />
        <meshStandardMaterial map={felt} roughness={0.92} />
      </mesh>
      {[[-3.3, -0.7, -1.9], [3.3, -0.7, -1.9], [-3.3, -0.7, 1.9], [3.3, -0.7, 1.9]].map((p) => (
        <mesh key={p.join(',')} position={p} castShadow>
          <boxGeometry args={[0.16, 0.85, 0.16]} />
          <meshStandardMaterial map={wood} roughness={0.7} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.72, 0.78, 40]} />
        <meshStandardMaterial color="#c9a227" metalness={0.6} roughness={0.3} />
      </mesh>
      <Candle position={[-3.2, 0.04, -1.8]} phase={0} />
      <Candle position={[3.2, 0.04, -1.8]} phase={1.2} />
      <Candle position={[-3.2, 0.04, 1.8]} phase={2.1} />
      <Candle position={[3.2, 0.04, 1.8]} phase={3.4} />
    </group>
  )
}

function SeatTag({ player, seat, self }) {
  const rest = SEATS[seat].rest
  return (
    <Html position={[rest[0] * 1.08, 0.72, rest[2] * 1.08]} center distanceFactor={7} occlude={false}>
      <div className={self ? 'seat-tag is-self' : 'seat-tag'}>
        {player ? (
          <>
            <Avatar name={player.name} src={player.avatar} size={44} />
            <span>{player.name}</span>
          </>
        ) : (
          <span className="empty-seat">Vacío</span>
        )}
      </div>
    </Html>
  )
}

function Scene({ seats, rolls, localSeat, showLabels, backgroundUrl }) {
  return (
    <>
      <Backdrop url={backgroundUrl} />
      {!backgroundUrl ? <fog attach="fog" args={['#070303', 10, 22]} /> : null}
      <ambientLight intensity={0.22} color="#ffd8c0" />
      <hemisphereLight args={['#3a1515', '#070303', 0.35]} />
      <directionalLight
        position={[3, 8, 4]}
        intensity={0.55}
        color="#ffe0c0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <Furniture />
      {seats.map((player, i) => (
        <SeatTag key={i} player={player} seat={i} self={player?.self} />
      ))}
      {rolls.map((pack) => (
        <group key={pack.id}>
          {pack.dice.map((die, i) => (
            <Die3D key={`${pack.id}-${i}`} die={die} play={pack.play} showLabels={showLabels} />
          ))}
        </group>
      ))}
    </>
  )
}

export default function Table3D({ seats, entries, localId, localSeat, showLabels, backgroundUrl, onClose }) {
  const controlsRef = useRef(null)
  const rolls = useMemo(() => {
    const latest = new Map()
    for (const entry of entries) {
      const pid = entry.player?.id
      if (!pid || !entry.result) continue
      const seat = seats.findIndex((p) => p?.id === pid)
      if (seat < 0) continue
      latest.set(pid, {
        id: entry.id,
        seat,
        play: Date.now() - entry.ts < 8000,
        dice: planDice(entry, seat),
      })
    }
    return Array.from(latest.values())
  }, [entries, seats])

  return (
    <div className="table-stage">
      <Canvas
        shadows
        dpr={[1, 1.6]}
        camera={{ fov: 36, position: SEATS[localSeat ?? 0].camera, near: 0.1, far: 60 }}
        gl={{ antialias: true, alpha: false }}
      >
        <Scene seats={seats} rolls={rolls} localSeat={localSeat} showLabels={showLabels} backgroundUrl={backgroundUrl} />
        <OrbitControls
          ref={controlsRef}
          target={[0, 0.15, 0]}
          enableRotate={false}
          enablePan
          enableZoom
          minDistance={3.5}
          maxDistance={26}
          mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
          touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
          makeDefault
        />
      </Canvas>
      {onClose ? (
        <button type="button" className="table-back" onClick={onClose} title="Volver al gamelog">← Volver</button>
      ) : null}
      {localSeat == null && localId ? <p className="table-note">Mesa llena · ves la crónica como espectador</p> : null}
      <button type="button" className="table-reset" onClick={() => controlsRef.current?.reset()} title="Restablecer la vista de la mesa">
        Restablecer
      </button>
      <p className="table-hint">Arrastra para mover · rueda o pellizco para zoom</p>
    </div>
  )
}
