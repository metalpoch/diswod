import { useEffect, useMemo, useState } from 'react'
import { parseCommand, previewCommand } from '../lib/parser'

export default function DicePanel({ onRoll, disabled, reason, lastCommands, value, onChange }) {
  const [rolling, setRolling] = useState(false)
  const [cursor, setCursor] = useState(-1)

  const parsed = useMemo(() => parseCommand(value), [value])
  const preview = previewCommand(parsed)
  const canRoll = parsed.ok && !disabled && !rolling

  useEffect(() => {
    setCursor(-1)
  }, [lastCommands])

  const submit = async (event) => {
    event?.preventDefault()
    if (!canRoll) return
    setRolling(true)
    await onRoll(parsed)
    onChange('')
    window.setTimeout(() => setRolling(false), 420)
  }

  const onKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      submit()
      return
    }
    if (event.key === 'ArrowUp' && lastCommands?.length) {
      event.preventDefault()
      const next = Math.min((cursor < 0 ? 0 : cursor + 1), lastCommands.length - 1)
      setCursor(next)
      onChange(lastCommands[next])
    }
    if (event.key === 'ArrowDown' && lastCommands?.length) {
      event.preventDefault()
      const next = cursor - 1
      if (next < 0) {
        setCursor(-1)
        onChange('')
      } else {
        setCursor(next)
        onChange(lastCommands[next])
      }
    }
  }

  return (
    <form className="dice-panel" onSubmit={submit}>
      <div className="field">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="/r 4wod6 ataque con espada"
          spellCheck={false}
          autoComplete="off"
          aria-label="Comando de dados"
        />
        <p className={disabled && reason ? 'hint bad' : parsed.ok ? 'hint ok' : value.trim() ? 'hint bad' : 'hint'}>
          {disabled && reason ? reason : value.trim() ? preview : 'Toca ? para ver los ejemplos de dados'}
        </p>
      </div>
      <button type="submit" className={rolling ? 'lanzar is-rolling' : 'lanzar'} disabled={!canRoll}>
        <span className="d10" aria-hidden="true">
          <svg viewBox="0 0 64 64">
            <polygon points="32,4 60,24 52,56 12,56 4,24" />
            <polyline points="32,4 32,56" />
            <polyline points="4,24 60,24" />
            <polyline points="12,56 32,24 52,56" />
          </svg>
        </span>
        Lanzar
      </button>
    </form>
  )
}
