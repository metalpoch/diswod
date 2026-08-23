import { Fragment, useState } from 'react'
import { formatTime } from '../lib/dice'
import Avatar from './Avatar'
import Lightbox from './Lightbox'

function Die({ die }) {
  const cls = [
    'die',
    die.isTen ? 'is-ten' : '',
    die.isOne ? 'is-one' : '',
    die.success && !die.isTen ? 'is-hit' : '',
    !die.success && !die.isOne ? 'is-miss' : '',
  ].filter(Boolean).join(' ')
  return <span className={cls}>{die.value}</span>
}

function WodDice({ dice, idPrefix }) {
  return (
    <>
      {dice.map((die, i) => (
        <Die key={`${idPrefix}-${i}`} die={die} />
      ))}
    </>
  )
}

function GenericDice({ dice, idPrefix }) {
  return (
    <>
      {dice.map((value, i) => (
        <span className="die is-generic" key={`${idPrefix}-${i}`}>{value}</span>
      ))}
    </>
  )
}

export default function LogEntry({ entry, photo }) {
  const result = entry.result
  const isWod = result.type === 'wod'
  const isGeneric = result.type === 'generic'
  const isMulti = result.type === 'multi'
  const [viewing, setViewing] = useState(false)
  const full = photo || entry.player?.avatar

  return (
    <article className="entry">
      <button
        type="button"
        className="entry-avatar"
        onClick={() => full && setViewing(true)}
        disabled={!full}
        title={full ? `Ver foto de ${entry.player?.name || 'jugador'}` : undefined}
      >
        <Avatar name={entry.player?.name} src={entry.player?.avatar} size={38} />
      </button>
      <div className="entry-body">
        <header>
          <strong>{entry.player?.name || 'Desconocido'}</strong>
          <code>{entry.command}</code>
          <time>{formatTime(entry.ts)}</time>
        </header>
        {result.description ? <p className="entry-desc">{result.description}</p> : null}
        {isWod ? (
          <>
            <div className="dice-row">
              <WodDice dice={result.dice} idPrefix={entry.id} />
            </div>
            <p className="entry-line">{entry.line}</p>
            <p className={result.botch ? 'entry-sum is-botch' : 'entry-sum'}>
              {result.botch ? <span className="botch">BOTCH</span> : null}
              <span className="ok">✅ {result.successes} successes</span>
              <span className="sep">|</span>
              <span className="bad">❌ {result.failures} failures</span>
            </p>
          </>
        ) : null}
        {isGeneric ? (
          <>
            <div className="dice-row generic">
              <GenericDice dice={result.dice} idPrefix={entry.id} />
              <span className="mod">
                {result.modifier >= 0 ? '+' : '−'}
                {Math.abs(result.modifier)}
              </span>
              <span className="total">{result.total}</span>
            </div>
            <p className="entry-line">{entry.line}</p>
          </>
        ) : null}
        {isMulti ? (
          <>
            <div className="dice-row multi">
              {result.pools.map((pool, pi) => (
                <Fragment key={`${entry.id}-p${pi}`}>
                  {pi > 0 ? <span className="pool-sep" title="Suma de reservas">+</span> : null}
                  {pool.type === 'wod'
                    ? <WodDice dice={pool.dice} idPrefix={`${entry.id}-p${pi}`} />
                    : <GenericDice dice={pool.dice} idPrefix={`${entry.id}-p${pi}`} />}
                </Fragment>
              ))}
            </div>
            <p className="entry-line">{entry.line}</p>
            {result.botch != null ? (
              <p className={result.botch ? 'entry-sum is-botch' : 'entry-sum'}>
                {result.botch ? <span className="botch">BOTCH</span> : null}
                <span className="ok">✅ {result.successes} successes</span>
                <span className="sep">|</span>
                <span className="bad">❌ {result.failures} failures</span>
              </p>
            ) : result.total != null ? (
              <p className="entry-sum"><span className="total">{result.total}</span></p>
            ) : null}
          </>
        ) : null}
      </div>
      {viewing && full ? (
        <Lightbox src={full} alt={entry.player?.name} onClose={() => setViewing(false)} />
      ) : null}
    </article>
  )
}
