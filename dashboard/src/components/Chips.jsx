import { LEVELS, ROUND_INFO, binOf, binWord, fmt } from '../lib.js'
import { TipCard, TipText, useTip } from './Tooltip.jsx'

// plain: no hover card of its own (used inside elements that already have one)
export function StatusChip({ level, children, tipText, plain }) {
  const tip = useTip()
  const l = LEVELS[level]
  const hover = plain
    ? {}
    : {
        tabIndex: 0,
        ...tip(() => (
          <TipCard eyebrow="Verdict" title={children ?? l.label}>
            <TipText>{tipText ?? l.desc}</TipText>
          </TipCard>
        )),
      }
  return (
    <span className={`chip chip-${level}`} {...hover}>
      <span className="chip-icon" aria-hidden="true">{l.icon}</span>
      {children ?? l.label}
    </span>
  )
}

export function RoundBadge({ round, plain }) {
  const tip = useTip()
  const hover = plain
    ? {}
    : {
        tabIndex: 0,
        ...tip(() => (
          <TipCard eyebrow="Benchmark round" title={`Round ${round}`}>
            <TipText>{ROUND_INFO[round] ?? `Tested in round ${round}.`}</TipText>
          </TipCard>
        )),
      }
  return (
    <span className={`round round-${round}`} aria-label={`Round ${round}`} {...hover}>
      R{round}
    </span>
  )
}

export function ErrorPill({ value }) {
  const bin = binOf(value)
  return (
    <span className={`pill heat-${bin}`} aria-label={`${fmt(value)}, ${binWord(value)}`}>
      {bin === 'fail' && <span aria-hidden="true">✕ </span>}
      {fmt(value)}
    </span>
  )
}

export function Caveat({ text }) {
  const tip = useTip()
  if (!text) return null
  return (
    <span
      className="caveat"
      tabIndex={0}
      aria-label={`Caveat: ${text}`}
      {...tip(() => (
        <TipCard eyebrow="Read with care" title="Latency caveat">
          <TipText>{text}</TipText>
        </TipCard>
      ))}
    >
      ⚠
    </span>
  )
}
