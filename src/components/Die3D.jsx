import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { geometryFor, labelColors, numberTexture, pipTexture } from '../lib/dice3d'

const bone = new THREE.Color('#efe6d2')
const gold = new THREE.Color('#c9a227')
const blood = new THREE.Color('#7a1616')
const hit = new THREE.Color('#d7e7c8')
const miss = new THREE.Color('#d2b4ae')

function bodyColor(style) {
  if (style === 'gold') return gold
  if (style === 'blood') return blood
  if (style === 'hit') return hit
  if (style === 'miss') return miss
  return bone
}

function D6({ style }) {
  const mats = useMemo(() => {
    const kind = style === 'gold' ? 'gold' : style === 'blood' ? 'blood' : 'bone'
    return [3, 4, 1, 6, 2, 5].map((n) => (
      <meshStandardMaterial
        key={n}
        attach={`material-${[3, 4, 1, 6, 2, 5].indexOf(n)}`}
        map={pipTexture(n, kind)}
        roughness={0.42}
        metalness={0.08}
      />
    ))
  }, [style])
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[0.38, 0.38, 0.38]} />
      {mats}
    </mesh>
  )
}

export default function Die3D({ die, play }) {
  const ref = useRef()
  const [done, setDone] = useState(!play)
  const born = useRef(performance.now() + die.delay * 1000)
  const from = useMemo(() => new THREE.Quaternion().setFromAxisAngle(die.axis, die.spins), [die])
  const geo = useMemo(() => geometryFor(die.sides), [die.sides])
  const label = useMemo(() => {
    const { fg, bg } = labelColors(die.style)
    return numberTexture(die.value, fg, bg)
  }, [die.value, die.style])

  useFrame(() => {
    const group = ref.current
    if (!group) return
    if (!play) {
      group.position.copy(die.target)
      group.quaternion.copy(die.final)
      return
    }
    const t = Math.min(1, Math.max(0, (performance.now() - born.current) / (die.duration * 1000)))
    const ease = 1 - (1 - t) ** 3
    const bounce = Math.abs(Math.sin(t * Math.PI * 2.2)) * (1 - t) * 1.25
    group.position.lerpVectors(die.origin, die.target, ease)
    group.position.y = die.target.y + bounce
    const tumble = new THREE.Quaternion().setFromAxisAngle(die.axis, (1 - ease) * die.spins * Math.PI * 2)
    group.quaternion.copy(from).premultiply(tumble).slerp(die.final, ease * ease)
    if (t >= 1 && !done) setDone(true)
  })

  return (
    <group ref={ref}>
      {die.sides === 6 ? (
        <D6 style={die.style} />
      ) : (
        <mesh geometry={geo} castShadow receiveShadow>
          <meshStandardMaterial
            color={done ? bodyColor(die.style) : bone}
            roughness={0.4}
            metalness={die.style === 'gold' ? 0.45 : 0.08}
            emissive={done && die.style === 'gold' ? gold : '#000'}
            emissiveIntensity={done && die.style === 'gold' ? 0.25 : 0}
          />
        </mesh>
      )}
      {done && (
        <Billboard position={[0, 0.42, 0]}>
          <mesh>
            <planeGeometry args={[0.3, 0.3]} />
            <meshBasicMaterial map={label} transparent depthTest={false} />
          </mesh>
        </Billboard>
      )}
    </group>
  )
}
