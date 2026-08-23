import { Fragment } from 'react'
import { formatTime } from '../lib/dice'
import Avatar from './Avatar'

function Die({ die }) {
  const cls = [
    'die',
    die.isTen ? 'is-ten' : '',
    die.isOne ? 'is-one' : '',
    die.success && !die.isTen ? 'is-hit' : '',
    !die.success && !die.isOne ? 'is-miss' : '',
    die.exploded ? 'is-extra' : '',
  ].filter(Boolean).join(' ')
  return (
    <span className={cls} title={die.exploded ? 'Dado extra conseguido con un 10' : undefined}>
      {die.value}
    </span>
  )
}

function WodDice({ dice, idPrefix }) {
  return (
    <>
      {dice.map((die, i) => (
        <Fragment key={`${idPrefix}-${i}`}>
          {i > 0 && die.exploded && !dice[i - 1].exploded ? (
            <span className="dice-plus" title="Dados extra conseguidos con 10s">
              ⟳ +{dice.filter((d) => d.exploded).length}
            </span>
          ) : null}
          <Die die={die} />
        </Fragment>
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

export default function LogEntry({ entry }) {
  const result = entry.result
  const isWod = result.type === 'wod'
  const isGeneric = result.type === 'generic'
  const isMulti = result.type === 'multi'

  return (
    <article className="entry">
      <Avatar name={entry.player?.name} src={entry.player?.avatar} size={38} />
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
    </article>
  )
}
