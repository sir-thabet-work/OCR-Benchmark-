import { data, fmt, gb, pct, secs } from '../lib.js'
import { RoundBadge } from './Chips.jsx'
import { TipCard, TipFlags, TipRows, TipText } from './Tooltip.jsx'

const short = (stems) => stems.map((x) => x.slice(0, 2)).join(', ')

function bestAndWorst(m) {
  const sorted = data.images.map((img) => [img, m.outputs[img.id].cer]).sort((a, b) => a[1] - b[1])
  return [sorted[0], sorted[sorted.length - 1]]
}

export function ModelTip({ m, hint }) {
  const s = m.summary
  const [best, worst] = bestAndWorst(m)
  return (
    <TipCard eyebrow={`${m.org} · ${m.size}`} title={m.name} badges={<RoundBadge round={m.round} />} hint={hint}>
      <TipRows
        rows={[
          ['Median CER', fmt(s.cerMedian)],
          ['Median w/o 02, 04', fmt(s.cerMedianFair)],
          ['Failures', `${pct(s.failureRate)}${s.failedImages.length ? ` (${short(s.failedImages)})` : ''}`],
          ['Loops', String(s.loops)],
          ['Best image', `${best[0].num} ${best[0].scenario} · ${fmt(best[1])}`],
          ['Worst image', `${worst[0].num} ${worst[0].scenario} · ${fmt(worst[1])}`],
          ['Runs as', m.precision ?? m.base],
          ['Speed / memory', `${secs(s.latencyMedian)} · ${s.vram == null ? 'API' : gb(s.vram)}`],
        ]}
      />
      <TipFlags
        flags={[
          m.overlap?.length > 0 && ['warning', `Trained on the sources of images ${short(m.overlap)}`],
          m.latencyCaveat && ['warning', `Speed: ${m.latencyCaveat}`],
        ]}
      />
      <TipText>{m.note}</TipText>
    </TipCard>
  )
}

export function ImageTip({ img, models }) {
  const ranked = models
    .filter((m) => m.level !== 'reference')
    .map((m) => [m, m.outputs[img.id].cer])
    .sort((a, b) => a[1] - b[1])
  const best = ranked[0]
  const worst = ranked[ranked.length - 1]
  return (
    <TipCard eyebrow={`Test image ${img.num}`} title={img.scenario}>
      <img className="tip-thumb" src={`./images/${img.file}`} alt="" />
      <TipRows
        rows={[
          ['Source', img.source],
          ['Ground truth', `${img.gt.length.toLocaleString()} chars`],
          best && ['Best open model', `${best[0].name} · ${fmt(best[1])}`],
          worst && ['Worst', `${worst[0].name} · ${fmt(worst[1])}`],
        ]}
      />
    </TipCard>
  )
}
