export default function Lightbox({ src, alt, onClose }) {
  return (
    <div className="photo-veil" onClick={onClose}>
      <div className="photo-frame" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt || ''} />
      </div>
      <button type="button" className="ghost photo-close" onClick={onClose}>✕ Cerrar</button>
    </div>
  )
}
