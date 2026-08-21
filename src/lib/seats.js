export const SEAT_COUNT = 4

export const SEATS = [
  { id: 0, rest: [0, 0, 2.2], camera: [0, 6.5, 8.4] },
  { id: 1, rest: [3.15, 0, 0], camera: [8.4, 6.5, 0] },
  { id: 2, rest: [0, 0, -2.2], camera: [0, 6.5, -8.4] },
  { id: 3, rest: [-3.15, 0, 0], camera: [-8.4, 6.5, 0] },
]

export function claimSeat(me, remotes) {
  const others = (remotes || []).filter((r) => r.id !== me.id)
  const taken = new Set(others.map((r) => r.seat).filter((s) => s != null))
  if (me.seat != null && me.seat >= 0 && me.seat < SEAT_COUNT && !taken.has(me.seat)) {
    return me.seat
  }
  for (let i = 0; i < SEAT_COUNT; i += 1) {
    if (!taken.has(i)) return i
  }
  return null
}

export function seatedPlayers(players) {
  const claimed = new Map()
  const sorted = [...players]
    .filter((p) => p?.id)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
  const waiting = []
  for (const p of sorted) {
    if (p.seat != null && p.seat >= 0 && p.seat < SEAT_COUNT && !claimed.has(p.seat)) {
      claimed.set(p.seat, { ...p, seat: p.seat })
    } else {
      waiting.push(p)
    }
  }
  for (const p of waiting) {
    const free = [0, 1, 2, 3].find((i) => !claimed.has(i))
    if (free == null) break
    claimed.set(free, { ...p, seat: free })
  }
  return [0, 1, 2, 3].map((i) => claimed.get(i) || null)
}

export function seatedFromMembers(members) {
  const seated = (members || []).filter((m) => m.role === 'dm' || m.role === 'player')
  const dm = seated.filter((m) => m.role === 'dm')
  const rest = seated.filter((m) => m.role !== 'dm')
  const ordered = [...dm, ...rest]
  return [0, 1, 2, 3].map((i) => {
    const m = ordered[i]
    if (!m) return null
    return {
      id: m.player_id || m.id,
      name: m.player_name || m.name,
      avatar: m.avatar || null,
      role: m.role,
      seat: i,
      self: Boolean(m.self),
    }
  })
}

export function hashSeed(value) {
  const text = String(value)
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
