import { useMemo, useState } from 'react'
import { fmt, gb, modelById, pct, secs } from '../lib.js'
import { Caveat, RoundBadge, StatusChip } from './Chips.jsx'
import { ModelTip } from './Tips.jsx'
import { TipCard, TipRows, TipText, useTip } from './Tooltip.jsx'

const COLUMNS = [
  {
    key: 'cerMedian', label: 'Median CER', get: (s) => s.cerMedian, bar: true,
    help: 'The middle CER across the 10 images. The headline score: one bad image cannot drag it up.',
  },
  {
    key: 'cerMedianFair', label: 'Median w/o 02, 04', get: (s) => s.cerMedianFair,
    help: 'Median CER without images 02 and 04. amad-vlm5/6 trained on their source datasets, so this is the fair comparison.',
  },
  {
    key: 'cerMean', label: 'Mean CER', get: (s) => s.cerMean,
    help: 'Average CER over the 10 images. A single repetition loop can push it far above the median.',
  },
  {
    key: 'cerMeanLoopCut', label: 'Loop-cut mean', get: (s) => s.cerMeanLoopCut,
    help: 'Mean CER after cutting detected repetition loops, as a production loop guard would. A secondary view only.',
  },
  {
    key: 'cerNdMean', label: 'CER, no diacritics', get: (s) => s.cerNdMean,
    help: 'Mean CER with tashkeel removed from both sides. A big gap to the strict CER means the model loses or invents diacritics.',
  },
  {
    key: 'werMean', label: 'WER', get: (s) => s.werMean,
    help: 'Mean word error rate: word edits divided by ground-truth words.',
  },
  {
    key: 'cerP95', label: 'p95 CER', get: (s) => s.cerP95,
    help: 'CER of the worst 5% of pages. Shows the bad tail that the median hides.',
  },
  {
    key: 'failureRate', label: 'Failures', get: (s) => s.failureRate, format: pct,
    help: 'Share of images with CER above 1.0, an empty output or an error: loops, invented text, crashes.',
  },
  {
    key: 'loops', label: 'Loops', get: (s) => s.loops, format: (v) => String(v),
    help: 'Outputs where the model repeated the same phrase until it stopped or hit its token limit.',
  },
  {
    key: 'latencyMedian', label: 'Latency / page', get: (s) => s.latencyMedian, format: secs, caveat: true,
    help: 'Median seconds per image on a Colab T4 (Gemini: through the API). Marked ⚠ where the number needs context.',
  },
  {
    key: 'vram', label: 'Peak memory', get: (s) => s.vram, format: gb,
    help: 'Highest GPU memory used on any image. Tells you which GPU the model fits on.',
  },
]
const BAR_MAX = 1.4
const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`

function CellTip({ m, col, models }) {
  const v = col.get(m.summary)
  const ranked = models.map((x) => col.get(x.summary)).filter((x) => x != null).sort((a, b) => a - b)
  const rank = v == null ? null : ranked.indexOf(v) + 1
  const ref = col.get(modelById.gemini.summary)
  const format = col.format ?? fmt
  return (
    <TipCard eyebrow={col.label} title={m.name} badges={<RoundBadge round={m.round} />}>
      <TipRows
        rows={[
          ['Value', v == null ? (col.key === 'vram' ? 'API, not measured' : '—') : format(v)],
          rank && ['Rank', `${ordinal(rank)} of ${ranked.length} shown (lower is better)`],
          m.id !== 'gemini' && ref != null && v != null && ['Gemini reference', format(ref)],
        ]}
      />
      {col.caveat && m.latencyCaveat && <TipText>⚠ {m.latencyCaveat}</TipText>}
    </TipCard>
  )
}

export default function Leaderboard({ models, onPick }) {
  const tip = useTip()
  const [sort, setSort] = useState({ key: 'cerMedian', dir: 1 })

  const rows = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sort.key)
    return [...models].sort((a, b) => {
      const va = col.get(a.summary)
      const vb = col.get(b.summary)
      if (va == null) return 1
      if (vb == null) return -1
      return (va - vb) * sort.dir
    })
  }, [sort, models])

  const toggle = (key) =>
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }))

  return (
    <div className="table-wrap">
      <table className="board">
        <thead>
          <tr>
            <th scope="col" className="col-model">Model</th>
            {COLUMNS.map((c) => (
              <th
                scope="col"
                key={c.key}
                aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
              >
                <button
                  className="sort"
                  onClick={() => toggle(c.key)}
                  {...tip(() => (
                    <TipCard eyebrow="Column" title={c.label} hint="Click to sort; click again to reverse">
                      <TipText>{c.help}</TipText>
                    </TipCard>
                  ))}
                >
                  {c.label}
                  <span className="sort-mark" aria-hidden="true">
                    {sort.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : ''}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className={m.level === 'reference' ? 'row-ref' : ''}>
              <th scope="row" className="col-model">
                <button
                  className="link"
                  onClick={() => onPick(m.id)}
                  {...tip(() => <ModelTip m={m} hint="Click to see this model's weakest image" />)}
                >
                  {m.name}
                </button>
                <div className="row-sub">
                  <RoundBadge round={m.round} />
                  <StatusChip level={m.level} tipText={m.note}>
                    {m.verdict}
                  </StatusChip>
                  <span className="muted">{m.size}</span>
                </div>
              </th>
              {COLUMNS.map((c) => {
                const v = c.get(m.summary)
                const text = v == null ? (c.key === 'vram' ? 'API' : '—') : (c.format ?? fmt)(v)
                return (
                  <td key={c.key} className="num">
                    <span className="num-hit" {...tip(() => <CellTip m={m} col={c} models={models} />)}>
                      {c.bar ? (
                        <span className="bar-cell">
                          <span className="bar-track">
                            <span
                              className={`bar ${m.level === 'reference' ? 'bar-ref' : ''}`}
                              style={{ width: `${Math.min(v / BAR_MAX, 1) * 100}%` }}
                            />
                          </span>
                          <span>{text}</span>
                        </span>
                      ) : (
                        text
                      )}
                    </span>
                    {c.caveat && <Caveat text={m.latencyCaveat} />}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
