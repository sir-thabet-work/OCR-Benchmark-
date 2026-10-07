import { useMemo, useState } from 'react'
import { data, fmt, pct, secs, gb } from '../lib.js'
import { Caveat, StatusChip } from './Chips.jsx'

const COLUMNS = [
  { key: 'cerMedian', label: 'Median CER', get: (s) => s.cerMedian, bar: true },
  { key: 'cerMean', label: 'Mean CER', get: (s) => s.cerMean },
  { key: 'cerNdMean', label: 'CER, no diacritics', get: (s) => s.cerNdMean },
  { key: 'werMean', label: 'WER', get: (s) => s.werMean },
  { key: 'cerP95', label: 'p95 CER', get: (s) => s.cerP95 },
  { key: 'failureRate', label: 'Failures', get: (s) => s.failureRate, format: pct },
  { key: 'latencyMedian', label: 'Latency / page', get: (s) => s.latencyMedian, format: secs, caveat: true },
  { key: 'vram', label: 'Peak memory', get: (s) => s.vram, format: gb },
]
const BAR_MAX = 1.4

export default function Leaderboard({ onPick }) {
  const [sort, setSort] = useState({ key: 'cerMedian', dir: 1 })

  const rows = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sort.key)
    return [...data.models].sort((a, b) => {
      const va = col.get(a.summary)
      const vb = col.get(b.summary)
      if (va == null) return 1
      if (vb == null) return -1
      return (va - vb) * sort.dir
    })
  }, [sort])

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
                <button className="sort" onClick={() => toggle(c.key)}>
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
                <button className="link" onClick={() => onPick(m.id)}>
                  {m.name}
                </button>
                <div className="row-sub">
                  <StatusChip level={m.level}>{m.verdict}</StatusChip>
                  <span className="muted">{m.size}</span>
                </div>
              </th>
              {COLUMNS.map((c) => {
                const v = c.get(m.summary)
                const text = v == null ? (c.key === 'vram' ? 'API' : '—') : (c.format ?? fmt)(v)
                return (
                  <td key={c.key} className="num">
                    {c.bar ? (
                      <div className="bar-cell">
                        <span className="bar-track">
                          <span
                            className={`bar ${m.level === 'reference' ? 'bar-ref' : ''}`}
                            style={{ width: `${Math.min(v / BAR_MAX, 1) * 100}%` }}
                          />
                        </span>
                        <span>{text}</span>
                      </div>
                    ) : (
                      <>
                        {text}
                        {c.caveat && <Caveat text={m.latencyCaveat} />}
                      </>
                    )}
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
