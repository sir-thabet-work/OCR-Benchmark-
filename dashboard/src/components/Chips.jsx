import { LEVELS, binOf, fmt } from '../lib.js'

export function StatusChip({ level, children }) {
  const l = LEVELS[level]
  return (
    <span className={`chip chip-${level}`}>
      <span className="chip-icon" aria-hidden="true">{l.icon}</span>
      {children ?? l.label}
    </span>
  )
}

export function RoundBadge({ round }) {
  return (
    <span className={`round round-${round}`} title={`Tested in round ${round}`}>
      R{round}
    </span>
  )
}

export function ErrorPill({ value, title }) {
  const bin = binOf(value)
  return (
    <span className={`pill heat-${bin}`} title={title}>
      {bin === 'fail' && <span aria-hidden="true">✕ </span>}
      {fmt(value)}
    </span>
  )
}

export function Caveat({ text }) {
  if (!text) return null
  return (
    <span className="caveat" title={text} aria-label={`Caveat: ${text}`}>
      ⚠
    </span>
  )
}
