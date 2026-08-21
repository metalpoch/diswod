import { colorFromName, initials } from '../lib/discord'

export default function Avatar({ name, src, size = 36 }) {
  const label = name || '?'
  return (
    <span className="avatar" style={{ width: size, height: size }} title={label}>
      {src ? (
        <img src={src} alt={label} />
      ) : (
        <span className="avatar-fallback" style={{ background: colorFromName(label) }}>
          {initials(label)}
        </span>
      )}
    </span>
  )
}
