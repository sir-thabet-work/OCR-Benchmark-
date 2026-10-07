import { useState } from 'react'
import { BINS, METRICS, binOf, data, fmt } from '../lib.js'

export default function Heatmap({ onSelect }) {
  const [metric, setMetric] = useState('cer')

  // best open model per image, for the marker
  const best = Object.fromEntries(
    data.images.map((img) => {
      const open = data.models.filter((m) => m.level !== 'reference')
      const min = Math.min(...open.map((m) => m.outputs[img.id][metric]))
      return [img.id, min]
    }),
  )

  return (
    <div className="heatmap">
      <div className="toolbar" role="radiogroup" aria-label="Metric">
        {Object.entries(METRICS).map(([key, m]) => (
          <button
            key={key}
            role="radio"
            aria-checked={metric === key}
            className={`seg ${metric === key ? 'seg-on' : ''}`}
            onClick={() => setMetric(key)}
            title={m.long}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table className="heat">
          <thead>
            <tr>
              <th scope="col" className="heat-corner">Model</th>
              {data.images.map((img) => (
                <th scope="col" key={img.id} title={img.scenario}>
                  <span className="heat-num">{img.num}</span>
                  <span className="heat-scn">{img.scenario}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.models.map((m) => (
              <tr key={m.id}>
                <th scope="row" className={m.level === 'reference' ? 'heat-ref' : ''}>
                  {m.name}
                </th>
                {data.images.map((img) => {
                  const o = m.outputs[img.id]
                  const v = o[metric]
                  const bin = binOf(v)
                  const isBest = m.level !== 'reference' && v === best[img.id]
                  const label = `${m.name} on ${img.num} ${img.scenario}: ${METRICS[metric].label} ${fmt(v)}${
                    o.loop ? ', repetition loop' : ''
                  }${o.failed ? ', failed' : ''}${isBest ? ', best open model' : ''}`
                  return (
                    <td key={img.id} className="heat-td">
                      <button
                        className={`heat-cell heat-${bin} ${isBest ? 'is-best' : ''}`}
                        onClick={() => onSelect(img.id, m.id)}
                        aria-label={label}
                        title={label}
                      >
                        {bin === 'fail' && <span aria-hidden="true">✕ </span>}
                        {fmt(v, v >= 10 ? 1 : 2)}
                        {o.loop && (
                          <span className="loop-mark" aria-hidden="true">
                            ↻
                          </span>
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="legend" aria-label="Legend">
        <span className="legend-title">{METRICS[metric].label}</span>
        {BINS.map((b, i) => (
          <span className="legend-item" key={b.label}>
            <span className={`swatch heat-${i}`} />
            {b.label}
          </span>
        ))}
        <span className="legend-item">
          <span className="swatch heat-fail">✕</span>
          above 1.00, failed
        </span>
        <span className="legend-item">
          <span className="swatch swatch-best" />
          best open model
        </span>
        <span className="legend-item">↻ repetition loop</span>
      </div>
    </div>
  )
}
