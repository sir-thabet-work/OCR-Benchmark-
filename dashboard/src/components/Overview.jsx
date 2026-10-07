import { data, modelById, fmt, pct, gb } from '../lib.js'
import { RoundBadge, StatusChip } from './Chips.jsx'

const names = (list) =>
  list.length <= 2 ? list.join(' and ') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`

export function StatTiles() {
  const ref = modelById.gemini
  const open = data.models.filter((m) => m.level !== 'reference')
  const best = open[0]
  const bestFair = [...open].sort((a, b) => a.summary.cerMedianFair - b.summary.cerMedianFair)[0]
  const loopers = open.filter((m) => m.summary.loops > 0)
  const loops = loopers.reduce((n, m) => n + m.summary.loops, 0)
  const unusable = open.filter((m) => m.level === 'critical')
  const tiles = [
    {
      label: 'Best open model, median CER',
      value: fmt(best.summary.cerMedian),
      foot: `${best.name}; Gemini reference ${fmt(ref.summary.cerMedian)}`,
    },
    {
      label: 'Best without training overlap',
      value: fmt(bestFair.summary.cerMedianFair),
      foot: `${bestFair.name}, images 02 and 04 left out`,
    },
    {
      label: 'Repetition loops',
      value: `${loops}`,
      unit: `of ${open.length * data.images.length} outputs`,
      foot: names(loopers.map((m) => m.name)),
    },
    {
      label: 'Not usable',
      value: `${unusable.length}`,
      unit: `of ${open.length} candidates`,
      foot: names(unusable.map((m) => m.name)),
    },
  ]
  return (
    <div className="tiles">
      {tiles.map((t) => (
        <div className="tile" key={t.label}>
          <div className="tile-label">{t.label}</div>
          <div className="tile-value">
            {t.value}
            {t.unit && <span className="tile-unit"> {t.unit}</span>}
          </div>
          <div className="tile-foot">{t.foot}</div>
        </div>
      ))}
    </div>
  )
}

export function Findings() {
  return (
    <ol className="findings">
      {data.findings.map((f) => (
        <li key={f.title}>
          <h3>{f.title}</h3>
          <p>{f.body}</p>
        </li>
      ))}
    </ol>
  )
}

export function ModelCards({ models, onPick }) {
  let rank = 0
  return (
    <div className="cards">
      {models.map((m) => (
        <button className={`card card-${m.level}`} key={m.id} onClick={() => onPick(m.id)}>
          <div className="card-top">
            <span className="card-rank">
              {m.level === 'reference' ? 'Ref' : `#${++rank}`} <RoundBadge round={m.round} />
            </span>
            <StatusChip level={m.level}>{m.verdict}</StatusChip>
          </div>
          <div className="card-name">{m.name}</div>
          <div className="card-meta">
            {m.org} · {m.base}
          </div>
          <dl className="card-stats">
            <div>
              <dt>Median CER</dt>
              <dd>{fmt(m.summary.cerMedian)}</dd>
            </div>
            <div>
              <dt>Failures</dt>
              <dd>{pct(m.summary.failureRate)}</dd>
            </div>
            <div>
              <dt>Memory</dt>
              <dd>{m.summary.vram == null ? 'API' : gb(m.summary.vram)}</dd>
            </div>
          </dl>
          <p className="card-note">{m.note}</p>
        </button>
      ))}
    </div>
  )
}
