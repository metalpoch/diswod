import { useEffect, useRef } from 'react'
import { formatHistoryText } from '../lib/dice'
import { copyText } from '../lib/clipboard'
import LogEntry from './LogEntry'

export default function GameLog({ entries, onCopy }) {
  const scroller = useRef(null)
  const pin = useRef(true)

  useEffect(() => {
    const el = scroller.current
    if (!el || !pin.current) return
    el.scrollTop = el.scrollHeight
  }, [entries])

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    pin.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const copy = async () => {
    const text = formatHistoryText(entries)
    if (!text) return
    const ok = await copyText(text)
    onCopy?.(ok)
  }

  return (
    <section className="gamelog">
      <header>
        <h2>Gamelog</h2>
        <button type="button" className="ghost" onClick={copy} disabled={!entries.length}>
          Copiar historial
        </button>
      </header>
      <div className="gamelog-scroll" ref={scroller} onScroll={onScroll}>
        {entries.length === 0 ? (
          <div className="empty">
            <p>La noche está en calma.</p>
            <p>Lanza el primer dado: <code>/r 3d6 acechar a la presa</code></p>
          </div>
        ) : (
          entries.map((entry) => (
            <LogEntry key={entry.id} entry={entry} />
          ))
        )}
      </div>
    </section>
  )
}
