import * as THREE from 'three'
import { hashSeed, mulberry32, SEATS } from './seats'

const UP = new THREE.Vector3(0, 1, 0)
const texCache = new Map()
const faceCache = new Map()
let wood = null
let felt = null

const D10_KITE_VALUES = [1, 2, 3, 4, 5, 10, 9, 8, 7, 6]

export const styleMaps = {
  body: { gold: '#d9b45c', blood: '#8f2424', hit: '#3f7a4e', miss: '#8a7f78', generic: '#efe6d2' },
  ink: { gold: '#23190a', blood: '#f3d9d4', hit: '#e7f2e2', miss: '#2b2724', generic: '#3a2c22' },
  glowColor: { gold: '#e6c35c', blood: '#ff7d70', hit: '#8fe3a2', miss: '#cfc4bd', generic: '#e8d9b8' },
  emissive: { gold: 0.38, blood: 0.2, hit: 0.16, miss: 0.08, generic: 0.1 },
}

function styleBody(style) {
  return styleMaps.body[style] || styleMaps.body.generic
}

function styleInk(style) {
  return styleMaps.ink[style] || styleMaps.ink.generic
}

function makeTexture(key, draw) {
  if (texCache.has(key)) return texCache.get(key)
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  draw(c.getContext('2d'))
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  texCache.set(key, tex)
  return tex
}

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
  return makeTexture(key, (ctx) => {
    ctx.fillStyle = styleBody(style)
    ctx.fillRect(0, 0, 128, 128)
    ctx.fillStyle = styleInk(style)
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
  })
}

export function pipGlowTexture(value) {
  const key = `pip-glow-${value}`
  return makeTexture(key, (ctx) => {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, 128, 128)
    ctx.fillStyle = '#fff'
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
  })
}

export function faceNumberTexture(value, style) {
  const key = `face-${value}-${style}`
  return makeTexture(key, (ctx) => {
    ctx.fillStyle = styleBody(style)
    ctx.fillRect(0, 0, 128, 128)
    ctx.font = faceFont(value)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    for (const [dx, dy] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) {
      ctx.fillText(String(value), 64 + dx, 68 + dy)
    }
    ctx.fillStyle = styleInk(style)
    ctx.fillText(String(value), 64, 68)
  })
}

export function faceGlowTexture(value) {
  const key = `face-glow-${value}`
  return makeTexture(key, (ctx) => {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, 128, 128)
    ctx.font = faceFont(value)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.fillText(String(value), 64, 68)
  })
}

export function plainFaceTexture(style) {
  const key = `plain-${style}`
  return makeTexture(key, (ctx) => {
    ctx.fillStyle = styleBody(style)
    ctx.fillRect(0, 0, 128, 128)
  })
}

function createD10Geometry() {
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
  return geo
}

function rawGeometry(sides) {
  if (sides === 4) return new THREE.TetrahedronGeometry(1)
  if (sides === 8) return new THREE.OctahedronGeometry(1)
  if (sides === 10) return createD10Geometry()
  if (sides === 12) return new THREE.DodecahedronGeometry(1)
  if (sides === 20) return new THREE.IcosahedronGeometry(1)
  return null
}

function faceFont(value) {
  if (value > 99) return '700 34px Cinzel, serif'
  if (value > 9) return '700 44px Cinzel, serif'
  return '700 58px Cinzel, serif'
}

const V = new THREE.Vector3()

function posKey(pos, index) {
  V.fromBufferAttribute(pos, index)
  return `${Math.round(V.x * 1e4)},${Math.round(V.y * 1e4)},${Math.round(V.z * 1e4)}`
}

function assignFaceUV(face, pos, uvs, normalsArr) {
  const corners = []
  const byKey = new Map()
  const n = face.normal
  for (const t of face.tris) {
    for (let k = 0; k < 3; k += 1) {
      const idx = t * 3 + k
      corners.push(idx)
      const key = posKey(pos, idx)
      if (!byKey.has(key)) byKey.set(key, [])
      byKey.get(key).push(idx)
      normalsArr[idx * 3] = n.x
      normalsArr[idx * 3 + 1] = n.y
      normalsArr[idx * 3 + 2] = n.z
    }
  }
  const keys = Array.from(byKey.keys())
  let uvByKey
  if (face.tris.length === 2 && keys.length === 4) {
    const shared = keys.filter((k) => byKey.get(k).length === 2)
    const uniq = keys.filter((k) => byKey.get(k).length === 1)
    uvByKey = [
      [shared[0], [0, 0]],
      [shared[1], [1, 0]],
      [uniq[0], [0.5, 1]],
      [uniq[1], [0.5, 0]],
    ]
  } else if (face.tris.length === 1 && keys.length === 3) {
    uvByKey = keys.map((k, i) => [k, i === 0 ? [0.5, 1] : i === 1 ? [0, 0] : [1, 0]])
  } else if (face.tris.length === 3 && keys.length === 5) {
    const interior = keys.find((k) => byKey.get(k).length === 3)
    const perimeter = keys.filter((k) => k !== interior)
    const cen = new THREE.Vector3()
    for (const k of perimeter) {
      V.fromBufferAttribute(pos, byKey.get(k)[0])
      cen.add(V)
    }
    cen.multiplyScalar(1 / perimeter.length)
    V.fromBufferAttribute(pos, byKey.get(perimeter[0])[0])
    const t1 = new THREE.Vector3().subVectors(V, cen).normalize()
    const t2 = new THREE.Vector3().crossVectors(n, t1)
    uvByKey = [[interior, [0.5, 0.5]]]
    for (const k of perimeter) {
      V.fromBufferAttribute(pos, byKey.get(k)[0])
      const d = new THREE.Vector3().subVectors(V, cen)
      const ang = Math.atan2(d.dot(t2), d.dot(t1))
      uvByKey.push([k, [0.5 + 0.5 * Math.cos(ang), 0.5 - 0.5 * Math.sin(ang)]])
    }
  } else {
    uvByKey = keys.map((k) => [k, [0.5, 0.5]])
  }
  const lookup = new Map(uvByKey)
  for (const idx of corners) {
    const uv = lookup.get(posKey(pos, idx))
    uvs[idx * 2] = uv[0]
    uvs[idx * 2 + 1] = uv[1]
  }
}

export function faceDataFor(sides) {
  if (faceCache.has(sides)) return faceCache.get(sides)
  const geo = rawGeometry(sides)
  if (!geo) {
    const data = {
      sides,
      geometry: new THREE.BoxGeometry(0.42, 0.42, 0.42),
      valueByFace: null,
      normals: [new THREE.Vector3(0, 1, 0)],
      generic: true,
    }
    faceCache.set(sides, data)
    return data
  }
  if (sides !== 10) geo.scale(0.3, 0.3, 0.3)
  const pos = geo.getAttribute('position')
  const triCount = pos.count / 3
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const n = new THREE.Vector3()
  const triNormals = []
  for (let t = 0; t < triCount; t += 1) {
    a.fromBufferAttribute(pos, t * 3)
    b.fromBufferAttribute(pos, t * 3 + 1)
    c.fromBufferAttribute(pos, t * 3 + 2)
    n.subVectors(b, a).cross(V.subVectors(c, a)).normalize()
    const cen = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3)
    if (n.dot(cen) < 0) n.negate()
    triNormals.push(n.toArray().map((x) => Math.round(x * 1000)).join(','))
  }
  const faces = []
  const faceByKey = new Map()
  const triFace = []
  for (let t = 0; t < triCount; t += 1) {
    const key = triNormals[t]
    let face = faceByKey.get(key)
    if (!face) {
      face = { tris: [], value: sides === 10 ? D10_KITE_VALUES[faces.length] : faces.length + 1, normal: null }
      faceByKey.set(key, face)
      faces.push(face)
    }
    face.tris.push(t)
    triFace.push(face)
  }
  for (const face of faces) {
    n.set(0, 0, 0)
    for (const t of face.tris) {
      a.fromBufferAttribute(pos, t * 3)
      b.fromBufferAttribute(pos, t * 3 + 1)
      c.fromBufferAttribute(pos, t * 3 + 2)
      n.add(new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)))
    }
    n.normalize()
    const cen = new THREE.Vector3()
    for (const t of face.tris) {
      a.fromBufferAttribute(pos, t * 3)
      b.fromBufferAttribute(pos, t * 3 + 1)
      c.fromBufferAttribute(pos, t * 3 + 2)
      cen.add(new THREE.Vector3().addVectors(a, b).add(c))
    }
    if (n.dot(cen) < 0) n.negate()
    face.normal = n.clone()
  }
  const uvs = new Float32Array(pos.count * 2)
  const normalsArr = new Float32Array(pos.count * 3)
  for (const face of faces) assignFaceUV(face, pos, uvs, normalsArr)
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geo.setAttribute('normal', new THREE.BufferAttribute(normalsArr, 3))
  geo.clearGroups()
  const materialIndex = new Map(faces.map((f, i) => [f, i]))
  for (let t = 0; t < triCount; t += 1) geo.addGroup(t * 3, 3, materialIndex.get(triFace[t]))
  const data = {
    sides,
    geometry: geo,
    valueByFace: faces.map((f) => f.value),
    normals: faces.map((f) => f.normal),
    generic: false,
  }
  faceCache.set(sides, data)
  return data
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
  const data = faceDataFor(sides)
  if (data.generic) return new THREE.Quaternion()
  const faceIdx = data.valueByFace.indexOf(value)
  const normal = data.normals[faceIdx] || data.normals[0]
  return new THREE.Quaternion().setFromUnitVectors(normal.clone().normalize(), UP)
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
