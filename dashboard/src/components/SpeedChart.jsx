import { useState } from 'react'
import { SHORT, fmt, secs } from '../lib.js'
import { ModelTip } from './Tips.jsx'
import { useTip } from './Tooltip.jsx'

const W = 720
const H = 470
const M = { l: 56, r: 28, t: 20, b: 52 }
const PW = W - M.l - M.r
const PH = H - M.t - M.b
// Both axes are log scales: the usable models crowd into 7-25 s and CER 0.13-0.28.
const X_MIN = 1
const X_MAX = 200
const Y_MIN = 0.1
const Y_MAX = 2
const X_TICKS = [1, 2, 5, 10, 20, 50, 100, 200]
const Y_TICKS = [0.1, 0.2, 0.5, 1, 2]

const x = (v) => M.l + (Math.log10(v / X_MIN) / Math.log10(X_MAX / X_MIN)) * PW
const y = (v) => M.t + (1 - Math.log10(Math.max(v, Y_MIN) / Y_MIN) / Math.log10(Y_MAX / Y_MIN)) * PH

// Hand-placed labels where points sit close together.
const LABEL = {
  gemini: { dx: -12, dy: 18, anchor: 'end' },
  katib: { dx: -12, dy: 0, anchor: 'end' },
  hunyuan: { dx: -12, dy: 4, anchor: 'end' },
  dots: { dx: 0, dy: -14, anchor: 'middle' },
  waqf: { dx: -12, dy: 4, anchor: 'end' },
}

export default function SpeedChart({ models, onPick }) {
  const tip = useTip()
  const [hover, setHover] = useState(null)
  const points = models.map((m) => ({
    m,
    cx: x(m.summary.latencyMedian),
    cy: y(m.summary.cerMedian),
  }))

  return (
    <figure className="chart">
      <div className="legend">
        <span className="legend-item">
          <span className="dot dot-open" /> Open model, Colab T4
        </span>
        <span className="legend-item">
          <span className="dot dot-ref" /> API reference
        </span>
      </div>
      <p className="swipe-hint" aria-hidden="true">Swipe the chart sideways to see all of it</p>
      <div className="chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Median CER against median latency per page, one point per model, log scales">
          <rect x={M.l} y={M.t} width={PW} height={PH} className="plot-bg" />
          {Y_TICKS.map((t) => (
            <g key={`y${t}`}>
              <line x1={M.l} x2={M.l + PW} y1={y(t)} y2={y(t)} className="grid" />
              <text x={M.l - 10} y={y(t) + 4} className="tick" textAnchor="end">
                {t}
              </text>
            </g>
          ))}
          <line x1={M.l} x2={M.l + PW} y1={M.t + PH} y2={M.t + PH} className="axis" />
          {X_TICKS.map((t) => (
            <g key={`x${t}`}>
              <line x1={x(t)} x2={x(t)} y1={M.t} y2={M.t + PH} className="grid" />
              <text x={x(t)} y={M.t + PH + 20} className="tick" textAnchor="middle">
                {t} s
              </text>
            </g>
          ))}
          <text x={M.l + PW / 2} y={H - 8} className="axis-title" textAnchor="middle">
            Median seconds per page (log scale)
          </text>
          <text
            transform={`translate(16 ${M.t + PH / 2}) rotate(-90)`}
            className="axis-title"
            textAnchor="middle"
          >
            Median CER (log scale)
          </text>
          <text x={M.l + 10} y={M.t + PH - 10} className="corner-note">
            ↙ faster and more accurate
          </text>

          {points.map(({ m, cx, cy }) => {
            const l = LABEL[m.id] ?? { dx: 12, dy: 4, anchor: 'start' }
            const ref = m.level === 'reference'
            const t = tip(() => <ModelTip m={m} hint="Click to see this model's weakest image" />, (el) =>
              el.querySelector('.mark'),
            )
            return (
              <g
                key={m.id}
                className={`pt ${hover === m.id ? 'pt-on' : ''}`}
                tabIndex={0}
                role="button"
                aria-label={`${m.name}, round ${m.round}: median CER ${fmt(m.summary.cerMedian)}, ${secs(m.summary.latencyMedian)} per page`}
                onMouseEnter={(e) => (setHover(m.id), t.onMouseEnter(e))}
                onMouseLeave={() => (setHover(null), t.onMouseLeave())}
                onFocus={(e) => (setHover(m.id), t.onFocus(e))}
                onBlur={() => (setHover(null), t.onBlur())}
                onClick={() => onPick(m.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick(m.id)}
              >
                <circle cx={cx} cy={cy} r={14} className="hit" />
                <circle cx={cx} cy={cy} r={6} className={ref ? 'mark mark-ref' : 'mark mark-open'} />
                <text x={cx + l.dx} y={cy + l.dy} textAnchor={l.anchor} className="pt-label">
                  {SHORT[m.id] ?? m.name}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <figcaption>
        Open models ran on a Colab T4 (7–8B models in 4-bit); Gemini ran through the API. Latency caveats are
        marked ⚠ in the leaderboard and on each point's hover card.
      </figcaption>
    </figure>
  )
}
