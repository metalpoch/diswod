import * as THREE from 'three'
import { hashSeed, mulberry32, SEATS } from './seats'

const UP = new THREE.Vector3(0, 1, 0)
const texCache = new Map()
let wood = null
let felt = null
let d10geo = null

export function woodTexture() {
  if (wood) return wood
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#3a1a10'
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 90; i += 1) {
    ctx.strokeStyle = `rgba(18,6,3,${0.04 + (i % 7) * 0.015})`
    ctx.lineWidth = 2 + (i % 5)
    const x = (i * 37) % 512
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.bezierCurveTo(x + 18, 160, x - 14, 340, x + 6, 512)
    ctx.stroke()
  }
  wood = new THREE.CanvasTexture(c)
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping
  wood.repeat.set(2.2, 1.4)
  wood.colorSpace = THREE.SRGBColorSpace
  return wood
}

export function feltTexture() {
  if (felt) return felt
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#4a1014'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 800; i += 1) {
    ctx.fillStyle = `rgba(0,0,0,${0.04 + (i % 5) * 0.02})`
    ctx.fillRect((i * 17) % 256, (i * 29) % 256, 2, 2)
  }
  felt = new THREE.CanvasTexture(c)
  felt.wrapS = felt.wrapT = THREE.RepeatWrapping
  felt.repeat.set(3, 2)
  felt.colorSpace = THREE.SRGBColorSpace
  return felt
}

export function pipTexture(value, style) {
  const key = `pip-${value}-${style}`
  if (texCache.has(key)) return texCache.get(key)
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')
  ctx.fillStyle = style === 'gold' ? '#c9a227' : style === 'blood' ? '#6b1212' : '#efe6d2'
  ctx.fillRect(0, 0, 128, 128)
  ctx.fillStyle = style === 'gold' ? '#2a1c04' : '#1a0808'
  const spots = {
    1: [[64, 64]],
    2: [[36, 36], [92, 92]],
    3: [[36, 36], [64, 64], [92, 92]],
    4: [[36, 36], [92, 36], [36, 92], [92, 92]],
    5: [[36, 36], [92, 36], [64, 64], [36, 92], [92, 92]],
    6: [[36, 32], [92, 32], [36, 64], [92, 64], [36, 96], [92, 96]],
  }
  for (const [x, y] of spots[value] || spots[1]) {
    ctx.beginPath()
    ctx.arc(x, y, 9, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  texCache.set(key, tex)
  return tex
}

export function numberTexture(value, fg, bg) {
  const key = `n-${value}-${fg}-${bg}`
  if (texCache.has(key)) return texCache.get(key)
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, 128, 128)
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.roundRect(8, 8, 112, 112, 18)
  ctx.fill()
  ctx.strokeStyle = fg
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillStyle = fg
  ctx.font = '700 58px Cinzel, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(value), 64, 70)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  texCache.set(key, tex)
  return tex
}

export function createD10Geometry() {
  if (d10geo) return d10geo
  const verts = [[0, 0, 1], [0, 0, -1]]
  for (let i = 0; i < 10; i += 1) {
    const b = (i * Math.PI * 2) / 10
    verts.push([Math.cos(b), Math.sin(b), 0.105 * (i % 2 ? 1 : -1)])
  }
  const faces = [
    [0, 2, 3], [0, 3, 4], [0, 4, 5], [0, 5, 6], [0, 6, 7],
    [0, 7, 8], [0, 8, 9], [0, 9, 10], [0, 10, 11], [0, 11, 2],
    [1, 3, 2], [1, 4, 3], [1, 5, 4], [1, 6, 5], [1, 7, 6],
    [1, 8, 7], [1, 9, 8], [1, 10, 9], [1, 11, 10], [1, 2, 11],
  ]
  const positions = []
  for (const face of faces) {
    for (const idx of face) {
      const v = verts[idx]
      positions.push(v[0], v[2], -v[1])
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.computeVertexNormals()
  geo.center()
  geo.scale(0.28, 0.34, 0.28)
  d10geo = geo
  return geo
}

export function quatForValue(sides, value) {
  if (sides === 6) {
    const normals = {
      1: new THREE.Vector3(0, 1, 0),
      2: new THREE.Vector3(0, 0, 1),
      3: new THREE.Vector3(1, 0, 0),
      4: new THREE.Vector3(-1, 0, 0),
      5: new THREE.Vector3(0, 0, -1),
      6: new THREE.Vector3(0, -1, 0),
    }
    return new THREE.Quaternion().setFromUnitVectors((normals[value] || normals[1]).clone().normalize(), UP)
  }
  const tilt = ((value * 2.399) % 1) * 0.35
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, value * 0.7, -tilt * 0.4))
}

export function dieStyle(die, type) {
  if (type === 'wod') {
    if (die.isTen) return 'gold'
    if (die.isOne) return 'blood'
    if (die.success) return 'hit'
    return 'miss'
  }
  return 'generic'
}

export function labelColors(style) {
  if (style === 'gold') return { fg: '#2a1c04', bg: '#e6c35c' }
  if (style === 'blood') return { fg: '#ffd0cb', bg: '#6b1212' }
  if (style === 'hit') return { fg: '#d9ffe4', bg: '#1d5a32' }
  if (style === 'miss') return { fg: '#ffd8d4', bg: '#5a201c' }
  return { fg: '#f3e6c4', bg: '#3a2410' }
}

export function planDice(entry, seatIndex) {
  const result = entry.result
  const rng = mulberry32(hashSeed(entry.id))
  const seat = SEATS[seatIndex] || SEATS[0]
  const toward = new THREE.Vector3(-seat.rest[0], 0, -seat.rest[2])
  if (toward.lengthSq() < 0.001) toward.set(0, 0, -1)
  toward.normalize()
  const side = new THREE.Vector3(-toward.z, 0, toward.x)
  const raw = result.type === 'wod'
    ? result.dice.map((d) => ({ value: d.value, sides: 10, meta: d, type: 'wod' }))
    : result.dice.map((value) => ({ value, sides: result.sides, meta: null, type: 'generic' }))
  const list = raw.slice(0, 16)
  return list.map((die, i) => {
    const col = i % 4
    const row = Math.floor(i / 4)
    const jitter = () => (rng() - 0.5) * 0.1
    const target = new THREE.Vector3(
      seat.rest[0] + toward.x * 0.95 + side.x * (col - 1.5) * 0.4 + jitter(),
      0.22,
      seat.rest[2] + toward.z * 0.95 + side.z * (col - 1.5) * 0.4 + row * 0.4 + jitter(),
    )
    const origin = target.clone()
      .add(toward.clone().multiplyScalar(-0.55))
      .add(new THREE.Vector3(0, 1.55 + rng() * 0.45, 0))
    const axis = new THREE.Vector3(rng() - 0.5, rng() * 0.4, rng() - 0.5).normalize()
    return {
      ...die,
      origin,
      target,
      axis,
      spins: 2.2 + rng() * 2.4,
      duration: 1.05 + rng() * 0.45,
      delay: i * 0.035,
      final: quatForValue(die.sides, die.value),
      style: dieStyle(die.meta || {}, die.type),
    }
  })
}

export function geometryFor(sides) {
  if (sides === 4) return new THREE.TetrahedronGeometry(0.28)
  if (sides === 8) return new THREE.OctahedronGeometry(0.26)
  if (sides === 10) return createD10Geometry()
  if (sides === 12) return new THREE.DodecahedronGeometry(0.26)
  if (sides === 20) return new THREE.IcosahedronGeometry(0.26)
  return new THREE.BoxGeometry(0.38, 0.38, 0.38)
}
