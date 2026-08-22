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

export default function LogEntry({ entry }) {
  const result = entry.result
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
        {result.type === 'wod' ? (
          <>
            <div className="dice-row">
              {result.dice.map((die, i) => (
                <Fragment key={`${entry.id}-${i}`}>
                  {i > 0 && die.exploded && !result.dice[i - 1].exploded ? (
                    <span className="dice-plus" title="Dados extra conseguidos con 10s">
                      ⟳ +{result.dice.filter((d) => d.exploded).length}
                    </span>
                  ) : null}
                  <Die die={die} />
                </Fragment>
              ))}
            </div>
            <p className="entry-line">{entry.line}</p>
            <p className={result.botch ? 'entry-sum is-botch' : 'entry-sum'}>
              {result.botch ? <span className="botch">BOTCH</span> : null}
              <span className="ok">✅ {result.successes} successes</span>
              <span className="sep">|</span>
              <span className="bad">❌ {result.failures} failures</span>
            </p>
          </>
        ) : (
          <>
            <div className="dice-row generic">
              {result.dice.map((value, i) => (
                <span className="die is-generic" key={`${entry.id}-${i}`}>{value}</span>
              ))}
              <span className="mod">
                {result.modifier >= 0 ? '+' : '−'}
                {Math.abs(result.modifier)}
              </span>
              <span className="total">{result.total}</span>
            </div>
            <p className="entry-line">{entry.line}</p>
          </>
        )}
      </div>
    </article>
  )
}
