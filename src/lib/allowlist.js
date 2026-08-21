export function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function parseAllowlist(raw = import.meta.env.VITE_CHRONICLE_ALLOWLIST) {
  return String(raw || '')
    .split(/[,;\n]/)
    .map((item) => normalizeKey(item))
    .filter(Boolean)
}

export function isChronicler(identity, allowlist = parseAllowlist()) {
  if (!identity || !allowlist.length) return false
  const keys = [identity.id, identity.name, identity.username]
    .filter(Boolean)
    .map(normalizeKey)
  return keys.some((key) => allowlist.includes(key))
}
