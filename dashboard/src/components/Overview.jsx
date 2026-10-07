import { data, modelById, fmt, pct, gb } from '../lib.js'
import { StatusChip } from './Chips.jsx'

const open = data.models.filter((m) => m.level !== 'reference')
const bestOpen = open[0]
const loops = open.reduce((n, m) => n + Object.values(m.outputs).filter((o) => o.loop).length, 0)
const unusable = open.filter((m) => m.level === 'critical').length

export function StatTiles() {
  const ref = modelById.gemini
  const tiles = [
    {
      label: 'Reference median CER',
      value: fmt(ref.summary.cerMedian),
      foot: `${ref.name}, no failures`,
    },
    {
      label: 'Best open model',
      value: fmt(bestOpen.summary.cerMedian),
      foot: `${bestOpen.name}, ${gb(bestOpen.summary.vram)} on a T4`,
    },
    {
      label: 'Repetition loops',
      value: `${loops}`,
      unit: `of ${open.length * data.images.length} outputs`,
      foot: 'Qari, Katib and Sherif',
    },
    {
      label: 'Not usable',
      value: `${unusable}`,
      unit: `of ${open.length} candidates`,
      foot: 'Waqf and Legal OCR',
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

export function ModelCards({ onPick }) {
  return (
    <div className="cards">
      {data.models.map((m, i) => (
        <button className={`card card-${m.level}`} key={m.id} onClick={() => onPick(m.id)}>
          <div className="card-top">
            <span className="card-rank">{m.level === 'reference' ? 'Ref' : `#${i}`}</span>
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
