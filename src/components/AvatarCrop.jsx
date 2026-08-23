import { useEffect, useRef, useState } from 'react'

const STAGE = 320
const OUT = 256

function toBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

export default function AvatarCrop({ src, onCancel, onConfirm }) {
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const imgRef = useRef(null)
  const drag = useRef(null)

  useEffect(() => {
    let active = true
    const img = new Image()
    img.onload = () => {
      if (!active) return
      const w = img.naturalWidth
      const h = img.naturalHeight
      const z = Math.max(STAGE / w, STAGE / h, 1)
      setZoom(z)
      setOff({ x: (STAGE - w * z) / 2, y: (STAGE - h * z) / 2 })
      setReady(true)
    }
    img.src = src
    return () => {
      active = false
      img.onload = null
    }
  }, [src])

  const down = (e) => {
    drag.current = { px: e.clientX, py: e.clientY, ox: off.x, oy: off.y }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const move = (e) => {
    if (!drag.current) return
    setOff({ x: drag.current.ox + (e.clientX - drag.current.px), y: drag.current.oy + (e.clientY - drag.current.py) })
  }
  const up = () => {
    drag.current = null
  }

  const setZoomAround = (z) => {
    const clamped = Math.min(4, Math.max(0.5, z))
    const center = STAGE / 2
    setOff((prev) => ({
      x: center - (center - prev.x) * (clamped / zoom),
      y: center - (center - prev.y) * (clamped / zoom),
    }))
    setZoom(clamped)
  }

  const confirm = () => {
    const img = imgRef.current
    if (!img || !ready || busy) return
    setBusy(true)
    const canvas = document.createElement('canvas')
    canvas.width = OUT
    canvas.height = OUT
    const ctx = canvas.getContext('2d')
    const side = STAGE / zoom
    ctx.drawImage(img, -off.x / zoom, -off.y / zoom, side, side, 0, 0, OUT, OUT)
    ctx.globalCompositeOperation = 'destination-in'
    ctx.beginPath()
    ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2)
    ctx.fill()

    const fullCanvas = document.createElement('canvas')
    const MAX = 1200
    const scale = Math.min(1, MAX / Math.max(img.naturalWidth || 1, img.naturalHeight || 1))
    fullCanvas.width = Math.max(1, Math.round((img.naturalWidth || 1) * scale))
    fullCanvas.height = Math.max(1, Math.round((img.naturalHeight || 1) * scale))
    fullCanvas.getContext('2d').drawImage(img, 0, 0, fullCanvas.width, fullCanvas.height)

    Promise.all([toBlob(canvas), toBlob(fullCanvas)]).then(([avatarBlob, fullBlob]) => {
      const avatarFile = avatarBlob ? new File([avatarBlob], 'avatar.png', { type: 'image/png' }) : null
      const fullFile = fullBlob ? new File([fullBlob], 'retrato.png', { type: 'image/png' }) : null
      onConfirm(avatarFile, fullFile)
      setBusy(false)
    })
  }

  return (
    <div className="crop-veil">
      <div className="crop-card">
        <h2>Recorta tu foto</h2>
        <p className="crop-copy">Arrastra para centrar y ajusta el zoom. El círculo es lo que se verá en la mesa.</p>
        <div
          className="crop-stage"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          {ready ? (
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              style={{ transform: `translate(${off.x}px, ${off.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
            />
          ) : null}
          <div className="crop-ring" />
        </div>
        <div className="crop-controls">
          <span>Zoom</span>
          <input
            type="range"
            min={0.5}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoomAround(Number(e.target.value))}
          />
        </div>
        <div className="crop-actions">
          <button type="button" className="ghost" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button type="button" className="primary" onClick={confirm} disabled={!ready || busy}>Guardar</button>
        </div>
      </div>
    </div>
  )
}
