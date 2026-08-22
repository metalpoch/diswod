import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { faceDataFor } from './dice3d'

describe('d10 geometry', () => {
  it('has exactly 10 kite faces with all values 1-10', () => {
    const data = faceDataFor(10)
    expect(data.generic).toBe(false)
    expect(data.valueByFace).toHaveLength(10)
    expect(new Set(data.valueByFace)).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
    expect(data.normals).toHaveLength(10)
  })

  it('opposite faces sum to 11', () => {
    const data = faceDataFor(10)
    for (let i = 0; i < 10; i += 1) {
      const n = data.normals[i]
      let found = false
      for (let j = 0; j < 10; j += 1) {
        if (n.dot(data.normals[j]) < -0.999) {
          expect(data.valueByFace[i] + data.valueByFace[j]).toBe(11)
          found = true
        }
      }
      expect(found).toBe(true)
    }
  })

  it('other dice have their expected face counts', () => {
    expect(faceDataFor(4).valueByFace).toHaveLength(4)
    expect(faceDataFor(8).valueByFace).toHaveLength(8)
    expect(faceDataFor(12).valueByFace).toHaveLength(12)
    expect(faceDataFor(20).valueByFace).toHaveLength(20)
  })

  it('all triangles are wound outward (no backface culling)', () => {
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const c = new THREE.Vector3()
    const n = new THREE.Vector3()
    for (const sides of [4, 8, 10, 12, 20]) {
      const data = faceDataFor(sides)
      const pos = data.geometry.getAttribute('position')
      for (const group of data.geometry.groups) {
        for (let t = group.start / 3; t < (group.start + group.count) / 3; t += 1) {
          a.fromBufferAttribute(pos, t * 3)
          b.fromBufferAttribute(pos, t * 3 + 1)
          c.fromBufferAttribute(pos, t * 3 + 2)
          n.subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize()
          const cen = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3)
          expect(n.dot(cen)).toBeGreaterThan(0)
        }
      }
    }
  })
})
