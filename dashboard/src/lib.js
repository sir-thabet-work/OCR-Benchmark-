import data from './data/benchmark.json'

export { data }

export const modelById = Object.fromEntries(data.models.map((m) => [m.id, m]))
export const imageById = Object.fromEntries(data.images.map((i) => [i.id, i]))

// Short names for chart labels.
export const SHORT = {
  gemini: 'Gemini 3.7 Flash',
  katib: 'Katib',
  qari: 'Qari',
  sherif: 'Sherif',
  baseer: 'Baseer-Nakba',
  waqf: 'Waqf',
  legal: 'Legal OCR',
}

export const LEVELS = {
  reference: { icon: '◆', label: 'Reference' },
  good: { icon: '✓', label: 'Contender' },
  warning: { icon: '!', label: 'Needs work' },
  critical: { icon: '✕', label: 'Not usable' },
}

export const METRICS = {
  cer: { label: 'CER', long: 'Character error rate, with diacritics' },
  cerNd: { label: 'CER, no diacritics', long: 'Character error rate, diacritics removed from both sides' },
  wer: { label: 'WER', long: 'Word error rate' },
}

// Error bins for the heatmap and pills. Above 1.0 the output is longer than the
// ground truth allows: a failure (loop or hallucination).
export const BINS = [
  { max: 0.05, label: '< 0.05' },
  { max: 0.1, label: '0.05 – 0.10' },
  { max: 0.2, label: '0.10 – 0.20' },
  { max: 0.35, label: '0.20 – 0.35' },
  { max: 0.6, label: '0.35 – 0.60' },
  { max: 1.0, label: '0.60 – 1.00' },
]

export function binOf(v) {
  if (v == null) return 'none'
  if (v > 1) return 'fail'
  return String(BINS.findIndex((b) => v < b.max || b.max === 1.0))
}

export const fmt = (v, d = 3) => (v == null ? '—' : v.toFixed(d))
export const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`)
export const secs = (v) => (v == null ? '—' : v < 10 ? `${v.toFixed(1)} s` : `${Math.round(v)} s`)
export const gb = (v) => (v == null ? '—' : `${v.toFixed(1)} GB`)

export const isArabicHeavy = (s) => (s.match(/[؀-ۿ]/g) || []).length > s.length * 0.2
