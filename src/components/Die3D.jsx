import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  faceDataFor,
  faceGlowTexture,
  faceNumberTexture,
  plainFaceTexture,
  styleMaps,
} from '../lib/dice3d'

function faceMaterial(value, style) {
  const glow = styleMaps.glowColor[style] || styleMaps.glowColor.generic
  const emissive = styleMaps.emissive[style] || styleMaps.emissive.generic
  return {
    map: faceNumberTexture(value, style),
    emissiveMap: faceGlowTexture(value),
    emissive,
    emissiveIntensity: emissive,
    roughness: 0.32,
    metalness: style === 'gold' ? 0.35 : 0.06,
  }
}

function D6({ style }) {
  const mats = useMemo(() => {
    const glow = styleMaps.glowColor[style] || styleMaps.glowColor.generic
    const emissive = styleMaps.emissive[style] || styleMaps.emissive.generic
    return [3, 4, 1, 6, 2, 5].map((n) => (
      <meshStandardMaterial
        key={n}
        attach={`material-${[3, 4, 1, 6, 2, 5].indexOf(n)}`}
        map={faceNumberTexture(n, style)}
        emissiveMap={faceGlowTexture(n)}
        emissive={glow}
        emissiveIntensity={emissive}
        roughness={0.32}
        metalness={style === 'gold' ? 0.35 : 0.06}
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

function Faces({ sides, style, value }) {
  const data = useMemo(() => faceDataFor(sides), [sides])
  const mats = useMemo(() => {
    if (data.generic) {
      const top = faceMaterial(value, style)
      const plain = {
        map: plainFaceTexture(style),
        roughness: top.roughness,
        metalness: top.metalness,
      }
      return [0, 1, 2, 3, 4, 5].map((i) => {
        const props = i === 2 ? top : plain
        return (
          <meshStandardMaterial
            key={i}
            attach={`material-${i}`}
            map={props.map}
            emissiveMap={props.emissiveMap}
            emissive={props.emissive}
            emissiveIntensity={props.emissiveIntensity}
            roughness={props.roughness}
            metalness={props.metalness}
          />
        )
      })
    }
    return data.valueByFace.map((faceValue, i) => {
      const props = faceMaterial(faceValue, style)
      return (
        <meshStandardMaterial
          key={`${faceValue}-${i}`}
          attach={`material-${i}`}
          map={props.map}
          emissiveMap={props.emissiveMap}
          emissive={props.emissive}
          emissiveIntensity={props.emissiveIntensity}
          roughness={props.roughness}
          metalness={props.metalness}
        />
      )
    })
  }, [data, style, value])
  return (
    <mesh geometry={data.geometry} castShadow receiveShadow>
      {mats}
    </mesh>
  )
}

export default function Die3D({ die, play, showLabels }) {
  const ref = useRef()
  const [done, setDone] = useState(!play)
  const born = useRef(performance.now() + die.delay * 1000)
  const from = useMemo(() => new THREE.Quaternion().setFromAxisAngle(die.axis, die.spins), [die])
  const label = useMemo(
    () => ({
      bg: styleMaps.body[die.style] || styleMaps.body.generic,
      ink: styleMaps.ink[die.style] || styleMaps.ink.generic,
    }),
    [die.style],
  )

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
      {die.sides === 6 ? <D6 style={die.style} /> : <Faces sides={die.sides} style={die.style} value={die.value} />}
      {done && showLabels && (
        <Html
          position={[0, 0.55, 0]}
          center
          distanceFactor={8}
          zIndexRange={[20000000, 19000000]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="die-label" style={{ background: label.bg, color: label.ink }}>
            {die.value}
          </div>
        </Html>
      )}
    </group>
  )
}
