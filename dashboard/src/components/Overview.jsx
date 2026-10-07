import { data, modelById, fmt, pct, gb } from '../lib.js'
import { RoundBadge, StatusChip } from './Chips.jsx'
import { ModelTip } from './Tips.jsx'
import { TipCard, TipRows, TipText, useTip } from './Tooltip.jsx'

const names = (list) =>
  list.length <= 2 ? list.join(' and ') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`

const top3 = (list, get) => list.slice(0, 3).map((m) => [m.name, fmt(get(m))])

export function StatTiles() {
  const tip = useTip()
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
      how: 'Lowest median CER among the 12 open candidates, over all 10 images.',
      rows: top3(open, (m) => m.summary.cerMedian),
    },
    {
      label: 'Best without training overlap',
      value: fmt(bestFair.summary.cerMedianFair),
      foot: `${bestFair.name}, images 02 and 04 left out`,
      how: 'Median CER over the 8 images without known training overlap. amad-vlm5/6 trained on the sources of 02 and 04.',
      rows: top3([...open].sort((a, b) => a.summary.cerMedianFair - b.summary.cerMedianFair), (m) => m.summary.cerMedianFair),
    },
    {
      label: 'Repetition loops',
      value: `${loops}`,
      unit: `of ${open.length * data.images.length} outputs`,
      foot: names(loopers.map((m) => m.name)),
      how: 'Outputs that repeat one phrase 10 or more times at the end, before stopping or hitting the token limit.',
      rows: loopers.map((m) => [m.name, `${m.summary.loops} loop${m.summary.loops > 1 ? 's' : ''}`]),
    },
    {
      label: 'Not usable',
      value: `${unusable.length}`,
      unit: `of ${open.length} candidates`,
      foot: names(unusable.map((m) => m.name)),
      how: 'Candidates whose failures or behavior rule them out on this test set as configured.',
      rows: unusable.map((m) => [m.name, `${pct(m.summary.failureRate)} failures`]),
    },
  ]
  return (
    <div className="tiles">
      {tiles.map((t) => (
        <div
          className="tile"
          key={t.label}
          tabIndex={0}
          {...tip(() => (
            <TipCard eyebrow="How this is computed" title={t.label}>
              <TipText>{t.how}</TipText>
              <TipRows rows={t.rows} />
            </TipCard>
          ))}
        >
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
  const tip = useTip()
  let rank = 0
  return (
    <>
      <p className="swipe-hint" aria-hidden="true">Swipe through all {models.length} models</p>
      <div className="cards">
        {models.map((m) => (
          <button
            className={`card card-${m.level}`}
            key={m.id}
            onClick={() => onPick(m.id)}
            {...tip(() => <ModelTip m={m} hint="Click to see this model's weakest image" />)}
          >
            <div className="card-top">
              <span className="card-rank">
                {m.level === 'reference' ? 'Ref' : `#${++rank}`} <RoundBadge round={m.round} plain />
              </span>
              <StatusChip level={m.level} plain>
                {m.verdict}
              </StatusChip>
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
    </>
  )
}
