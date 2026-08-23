import { useEffect, useRef, useState } from 'react'

const STAGE = 320
const OUT = 256

function toBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

function exifOrientation(arrayBuffer) {
  const view = new DataView(arrayBuffer)
  if (view.getUint16(0, false) !== 0xFFD8) return 1
  let offset = 2
  while (offset < view.byteLength - 2) {
    const marker = view.getUint16(offset, false)
    offset += 2
    if (marker === 0xFFE1) {
      const length = view.getUint16(offset, false)
      if (view.getUint32(offset + 2, false) === 0x45786966) {
        const tiffOffset = offset + 8
        const bigEndian = view.getUint16(tiffOffset, false) === 0x4D4D
        const ifdOffset = view.getUint32(tiffOffset + 4, !bigEndian)
        const numEntries = view.getUint16(tiffOffset + ifdOffset, !bigEndian)
        for (let i = 0; i < numEntries; i++) {
          const entryOffset = tiffOffset + ifdOffset + 2 + i * 12
          if (entryOffset + 12 > view.byteLength) break
          if (view.getUint16(entryOffset, !bigEndian) === 0x0112) {
            return view.getUint16(entryOffset + 8, !bigEndian)
          }
        }
      }
      break
    }
    offset += view.getUint16(offset, false)
  }
  return 1
}

function orientationTransform(orientation) {
  switch (orientation) {
    case 2: return { scaleX: -1, scaleY: 1, swap: false }
    case 3: return { scaleX: -1, scaleY: -1, swap: false }
    case 4: return { scaleX: 1, scaleY: -1, swap: false }
    case 5: return { scaleX: 1, scaleY: 1, swap: true, transpose: true }
    case 6: return { scaleX: 1, scaleY: 1, swap: true, rotate: 1 }
    case 7: return { scaleX: -1, scaleY: 1, swap: true, transpose: true }
    case 8: return { scaleX: 1, scaleY: 1, swap: true, rotate: 3 }
    default: return { scaleX: 1, scaleY: 1, swap: false }
  }
}

function drawImageOriented(ctx, img, dw, dh, orientation) {
  const t = orientationTransform(orientation)
  ctx.save()
  if (t.rotate) {
    ctx.translate(dw, 0)
    ctx.rotate((t.rotate * Math.PI) / 2)
  }
  if (t.transpose) {
    ctx.translate(dw, 0)
    ctx.scale(t.scaleY, t.scaleX)
  } else {
    if (t.scaleX < 0) ctx.translate(dw, 0)
    if (t.scaleY < 0) ctx.translate(0, dh)
    ctx.scale(t.scaleX, t.scaleY)
  }
  ctx.drawImage(img, 0, 0, dw, dh)
  ctx.restore()
}

export default function AvatarCrop({ src, onCancel, onConfirm }) {
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const imgRef = useRef(null)
  const drag = useRef(null)
  const orientationRef = useRef(1)

  useEffect(() => {
    let active = true
    fetch(src)
      .then((res) => res.arrayBuffer())
      .then((buf) => {
        if (!active) return
        orientationRef.current = exifOrientation(buf)
      })
      .catch(() => {})
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
    const orientation = orientationRef.current
    const t = orientationTransform(orientation)

    const canvas = document.createElement('canvas')
    canvas.width = OUT
    canvas.height = OUT
    const ctx = canvas.getContext('2d')
    ctx.save()
    ctx.beginPath()
    ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2)
    ctx.clip()
    if (t.rotate) {
      ctx.translate(OUT, 0)
      ctx.rotate((t.rotate * Math.PI) / 2)
    }
    if (t.transpose) {
      ctx.translate(OUT, 0)
      ctx.scale(t.scaleY, t.scaleX)
    } else {
      if (t.scaleX < 0) ctx.translate(OUT, 0)
      if (t.scaleY < 0) ctx.translate(0, OUT)
      ctx.scale(t.scaleX, t.scaleY)
    }
    const side = STAGE / zoom
    ctx.drawImage(img, -off.x / zoom, -off.y / zoom, side, side, 0, 0, OUT, OUT)
    ctx.restore()

    const fullCanvas = document.createElement('canvas')
    const MAX = 1200
    const scale = Math.min(1, MAX / Math.max(img.naturalWidth || 1, img.naturalHeight || 1))
    fullCanvas.width = Math.max(1, Math.round((img.naturalWidth || 1) * scale))
    fullCanvas.height = Math.max(1, Math.round((img.naturalHeight || 1) * scale))
    drawImageOriented(fullCanvas.getContext('2d'), img, fullCanvas.width, fullCanvas.height, orientation)

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
