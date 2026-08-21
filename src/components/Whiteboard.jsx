import { useEffect, useRef, useState } from 'react'
import { loadBoard, saveBoard } from '../lib/mesasApi'

const COLORS = ['#eadfcd', '#c9a227', '#c42323', '#3d9a58', '#1a0808']

export default function Whiteboard({ mesaId, playerId }) {
  const canvasRef = useRef(null)
  const strokes = useRef([])
  const current = useRef(null)
  const [color, setColor] = useState('#eadfcd')
  const [erasing, setErasing] = useState(false)
  const [status, setStatus] = useState('')
  const timer = useRef(null)

  const redraw = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { width, height } = canvas
    ctx.fillStyle = '#140808'
    ctx.fillRect(0, 0, width, height)
    for (const stroke of strokes.current) {
      if (!stroke.points?.length) continue
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over'
      ctx.beginPath()
      stroke.points.forEach(([x, y], i) => {
        const px = x * width
        const py = y * height
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.stroke()
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  const fit = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.parentElement.getBoundingClientRect()
    canvas.width = Math.max(200, Math.floor(rect.width))
    canvas.height = Math.max(200, Math.floor(rect.height - 52))
    redraw()
  }

  useEffect(() => {
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  useEffect(() => {
    if (!mesaId || !playerId) return undefined
    let active = true
    loadBoard(mesaId, playerId).then((saved) => {
      if (!active) return
      strokes.current = Array.isArray(saved) ? saved : []
      redraw()
    }).catch(() => {})
    return () => {
      active = false
    }
  }, [mesaId, playerId])

  const persist = () => {
    setStatus('Guardando…')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      saveBoard(mesaId, playerId, strokes.current)
        .then(() => setStatus('Guardado'))
        .catch(() => setStatus('Error al guardar'))
    }, 600)
  }

  const point = (event) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const src = event.touches ? event.touches[0] : event
    return [(src.clientX - rect.left) / rect.width, (src.clientY - rect.top) / rect.height]
  }

  const start = (event) => {
    event.preventDefault()
    current.current = {
      color,
      width: erasing ? 18 : 2.4,
      erase: erasing,
      points: [point(event)],
    }
    strokes.current = [...strokes.current, current.current]
  }

  const move = (event) => {
    if (!current.current) return
    event.preventDefault()
    current.current.points.push(point(event))
    redraw()
  }

  const end = () => {
    if (!current.current) return
    current.current = null
    persist()
  }

  const clear = () => {
    strokes.current = []
    redraw()
    persist()
  }

  return (
    <section className="tool-pane board-pane">
      <header>
        <h2>Pizarra</h2>
        <small>{status}</small>
      </header>
      <div className="board-tools">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={color === c && !erasing ? 'swatch is-on' : 'swatch'}
            style={{ background: c }}
            onClick={() => {
              setColor(c)
              setErasing(false)
            }}
            aria-label={c}
          />
        ))}
        <button type="button" className={erasing ? 'ghost is-on' : 'ghost'} onClick={() => setErasing((v) => !v)}>
          Borrar
        </button>
        <button type="button" className="ghost" onClick={clear}>Limpiar</button>
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
    </section>
  )
}
