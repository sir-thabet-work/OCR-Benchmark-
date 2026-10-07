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
  amad6: 'amad-vlm6',
  amad5: 'amad-vlm5',
  dots: 'dots.ocr',
  hunyuan: 'HunyuanOCR',
  fanar: 'Fanar',
  ain: 'AIN',
}

export const ROUNDS = [...new Set(data.models.map((m) => m.round))].sort()

export const isOverlap = (model, imageId) => model.overlap?.includes(imageId)

export const LEVELS = {
  reference: { icon: '◆', label: 'Reference', desc: 'Frontier API model used as the upper bound. Not a candidate.' },
  good: { icon: '✓', label: 'Contender', desc: 'Usable now and in the running for the final choice.' },
  warning: { icon: '!', label: 'Needs work', desc: 'Reads well in places, but has a problem to fix first (loops, preambles, early stops).' },
  critical: { icon: '✕', label: 'Not usable', desc: 'Fails too often on this test set to be considered as configured.' },
}

export const ROUND_INFO = {
  1: 'Round 1 · 6 Oct 2026 · six candidates plus the Gemini reference',
  2: 'Round 2 · 7 Oct 2026 · six new candidates, same images and protocol',
}

export const METRICS = {
  cer: { label: 'CER', long: 'Character error rate, with diacritics' },
  cerNd: { label: 'CER, no diacritics', long: 'Character error rate, diacritics removed from both sides' },
  wer: { label: 'WER', long: 'Word error rate' },
}

// Error bins for the heatmap and pills. Above 1.0 the output is longer than the
// ground truth allows: a failure (loop or hallucination).
export const BINS = [
  { max: 0.05, label: '< 0.05', word: 'Near perfect' },
  { max: 0.1, label: '0.05 – 0.10', word: 'Very good' },
  { max: 0.2, label: '0.10 – 0.20', word: 'Good' },
  { max: 0.35, label: '0.20 – 0.35', word: 'Fair' },
  { max: 0.6, label: '0.35 – 0.60', word: 'Poor' },
  { max: 1.0, label: '0.60 – 1.00', word: 'Very poor' },
]

export function binWord(v) {
  const b = binOf(v)
  if (b === 'none') return ''
  return b === 'fail' ? 'Failed' : BINS[Number(b)].word
}

export function binOf(v) {
  if (v == null) return 'none'
  if (v > 1) return 'fail'
  return String(BINS.findIndex((b) => v < b.max || b.max === 1.0))
}

export const fmt = (v, d = 3) => (v == null ? '—' : v.toFixed(d))
export const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`)
export const secs = (v) => (v == null ? '—' : v < 10 ? `${v.toFixed(1)} s` : `${Math.round(v)} s`)
export const gb = (v) => (v == null ? '—' : `${v.toFixed(1)} GB`)

export const preview = (s, n = 120) => {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}

export const isArabicHeavy = (s) => (s.match(/[؀-ۿ]/g) || []).length > s.length * 0.2
