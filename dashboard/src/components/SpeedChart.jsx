import { useState } from 'react'
import { SHORT, data, fmt, gb, secs } from '../lib.js'

const W = 720
const H = 380
const M = { l: 56, r: 28, t: 20, b: 52 }
const PW = W - M.l - M.r
const PH = H - M.t - M.b
const X_MIN = 1
const X_MAX = 200
const Y_MAX = 1.4
const X_TICKS = [1, 2, 5, 10, 20, 50, 100, 200]
const Y_TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4]

const x = (v) => M.l + (Math.log10(v / X_MIN) / Math.log10(X_MAX / X_MIN)) * PW
const y = (v) => M.t + (1 - v / Y_MAX) * PH

// Hand-placed labels: Gemini and Katib sit almost on top of each other.
const LABEL = {
  gemini: { dx: -12, dy: -10, anchor: 'end' },
  katib: { dx: -12, dy: 18, anchor: 'end' },
  waqf: { dx: -12, dy: 4, anchor: 'end' },
}

export default function SpeedChart({ onPick }) {
  const [hover, setHover] = useState(null)
  const points = data.models.map((m) => ({
    m,
    cx: x(m.summary.latencyMedian),
    cy: y(m.summary.cerMedian),
  }))
  const hp = hover && points.find((p) => p.m.id === hover)

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
      <div className="chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Median CER against median latency per page, one point per model">
          <rect x={M.l} y={M.t} width={PW} height={PH} className="plot-bg" />
          {Y_TICKS.map((t) => (
            <g key={`y${t}`}>
              <line x1={M.l} x2={M.l + PW} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis' : 'grid'} />
              <text x={M.l - 10} y={y(t) + 4} className="tick" textAnchor="end">
                {t.toFixed(1)}
              </text>
            </g>
          ))}
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
            Median CER
          </text>
          <text x={M.l + 10} y={M.t + PH - 10} className="corner-note">
            ↙ faster and more accurate
          </text>

          {points.map(({ m, cx, cy }) => {
            const l = LABEL[m.id] ?? { dx: 12, dy: 4, anchor: 'start' }
            const ref = m.level === 'reference'
            return (
              <g
                key={m.id}
                className={`pt ${hover === m.id ? 'pt-on' : ''}`}
                tabIndex={0}
                role="button"
                aria-label={`${m.name}: median CER ${fmt(m.summary.cerMedian)}, ${secs(m.summary.latencyMedian)} per page`}
                onMouseEnter={() => setHover(m.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(m.id)}
                onBlur={() => setHover(null)}
                onClick={() => onPick(m.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick(m.id)}
              >
                <circle cx={cx} cy={cy} r={16} className="hit" />
                <circle cx={cx} cy={cy} r={6.5} className={ref ? 'mark mark-ref' : 'mark mark-open'} />
                <text x={cx + l.dx} y={cy + l.dy} textAnchor={l.anchor} className="pt-label">
                  {SHORT[m.id]}
                </text>
              </g>
            )
          })}
        </svg>
        {hp && (
          <div
            className="tooltip"
            style={{ left: `${(hp.cx / W) * 100}%`, top: `${(hp.cy / H) * 100}%` }}
            role="status"
          >
            <strong>{hp.m.name}</strong>
            <span>Median CER {fmt(hp.m.summary.cerMedian)}</span>
            <span>
              {secs(hp.m.summary.latencyMedian)} per page ·{' '}
              {hp.m.summary.vram == null ? 'API' : gb(hp.m.summary.vram)}
            </span>
            {hp.m.latencyCaveat && <span className="tooltip-note">⚠ {hp.m.latencyCaveat}</span>}
          </div>
        )}
      </div>
      <figcaption>
        Open models ran on a Colab T4 in fp16; Gemini ran through the API. Latency caveats are marked ⚠ in
        the leaderboard and in each tooltip.
      </figcaption>
    </figure>
  )
}
