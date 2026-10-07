import { useState } from 'react'
import { BINS, METRICS, SHORT, binOf, binWord, data, fmt, isOverlap, preview, secs } from '../lib.js'
import { ErrorPill, RoundBadge } from './Chips.jsx'
import { ImageTip, ModelTip } from './Tips.jsx'
import { TipCard, TipFlags, TipRows, TipText, useTip } from './Tooltip.jsx'

const METRIC_HELP = {
  cer: 'Character edits needed to turn the output into the ground truth, divided by its length. Strict: diacritics count.',
  cerNd: 'The same character error rate with tashkeel removed from both sides. Shows reading without diacritics.',
  wer: 'Word edits divided by the number of ground-truth words. Closer to how a reader feels the errors.',
}

function CellTip({ m, img, o, metric, isBest, overlap }) {
  return (
    <TipCard
      eyebrow={`Image ${img.num} · ${img.scenario}`}
      title={m.name}
      badges={<RoundBadge round={m.round} />}
      hint="Click to compare every model's output on this image"
    >
      <div className="tip-metric">
        <ErrorPill value={o[metric]} />
        <span className="tip-metric-label">
          {METRICS[metric].label} · {binWord(o[metric])}
        </span>
      </div>
      <TipRows
        rows={[
          metric !== 'cer' && ['CER', fmt(o.cer)],
          metric !== 'cerNd' && ['CER, no diacritics', fmt(o.cerNd)],
          metric !== 'wer' && ['WER', fmt(o.wer)],
          ['Time', secs(o.latency)],
          ['Output length', `${o.text.length.toLocaleString()} chars`],
        ]}
      />
      <TipFlags
        flags={[
          isBest && ['good', 'Best open model on this image'],
          o.failed && ['critical', `Failed: ${o.reasons.join(', ')}`],
          o.loop && ['warning', `Repetition loop after ${o.loop.keptChars.toLocaleString()} chars`],
          overlap && ['warning', "Trained on this image's source: score not trustworthy"],
        ]}
      />
      {o.text.trim() && (
        <p className="tip-preview" dir="auto">
          {preview(o.text)}
        </p>
      )}
    </TipCard>
  )
}

export default function Heatmap({ models, onSelect }) {
  const tip = useTip()
  const [metric, setMetric] = useState('cer')

  // best open model per image, for the marker
  const open = models.filter((m) => m.level !== 'reference')
  const best = Object.fromEntries(
    data.images.map((img) => [img.id, Math.min(...open.map((m) => m.outputs[img.id][metric]))]),
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
            {...tip(() => (
              <TipCard eyebrow="Metric" title={m.long}>
                <TipText>{METRIC_HELP[key]}</TipText>
                <TipText>0 is perfect; lower is better.</TipText>
              </TipCard>
            ))}
          >
            {m.label}
          </button>
        ))}
      </div>

      <p className="swipe-hint" aria-hidden="true">Swipe the grid sideways for all 10 images</p>
      <div className="table-wrap">
        <table className="heat">
          <thead>
            <tr>
              <th scope="col" className="heat-corner">Model</th>
              {data.images.map((img) => (
                <th scope="col" key={img.id} tabIndex={0} className="heat-col" {...tip(() => <ImageTip img={img} models={models} />)}>
                  <span className="heat-num">{img.num}</span>
                  <span className="heat-scn">{img.scenario}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.id}>
                <th scope="row" className={m.level === 'reference' ? 'heat-ref' : ''}>
                  <RoundBadge round={m.round} />{' '}
                  <span className="heat-name" tabIndex={0} {...tip(() => <ModelTip m={m} />)}>
                    <span className="name-full">{m.name}</span>
                    <span className="name-short">{SHORT[m.id] ?? m.name}</span>
                  </span>
                </th>
                {data.images.map((img) => {
                  const o = m.outputs[img.id]
                  const v = o[metric]
                  const bin = binOf(v)
                  const isBest = m.level !== 'reference' && v === best[img.id]
                  const overlap = isOverlap(m, img.id)
                  const label = `${m.name} on ${img.num} ${img.scenario}: ${METRICS[metric].label} ${fmt(v)}${
                    o.loop ? ', repetition loop' : ''
                  }${o.failed ? ', failed' : ''}${isBest ? ', best open model' : ''}${
                    overlap ? ', trained on this image source: not trustworthy' : ''
                  }`
                  return (
                    <td key={img.id} className="heat-td">
                      <button
                        className={`heat-cell heat-${bin} ${isBest ? 'is-best' : ''} ${overlap ? 'is-overlap' : ''}`}
                        onClick={() => onSelect(img.id, m.id)}
                        aria-label={label}
                        {...tip(() => (
                          <CellTip m={m} img={img} o={o} metric={metric} isBest={isBest} overlap={overlap} />
                        ))}
                      >
                        {bin === 'fail' && <span aria-hidden="true">✕ </span>}
                        {fmt(v, v >= 10 ? 1 : 2)}
                        {o.loop && (
                          <span className="loop-mark" aria-hidden="true">
                            ↻
                          </span>
                        )}
                        {overlap && (
                          <span className="overlap-mark" aria-hidden="true">
                            ⚠
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
          <span
            className="legend-item"
            key={b.label}
            tabIndex={0}
            {...tip(() => (
              <TipCard eyebrow="Error band" title={b.word}>
                <TipText>
                  {i === 0
                    ? `Fewer than ${Math.round(b.max * 100)} wrong ${metric === 'wer' ? 'words' : 'characters'} in every 100.`
                    : `${Math.round(BINS[i - 1].max * 100)} to ${Math.round(b.max * 100)} wrong ${
                        metric === 'wer' ? 'words' : 'characters'
                      } in every 100.`}
                </TipText>
              </TipCard>
            ))}
          >
            <span className={`swatch heat-${i}`} />
            {b.label}
          </span>
        ))}
        <span
          className="legend-item"
          tabIndex={0}
          {...tip(() => (
            <TipCard eyebrow="Error band" title="Failed">
              <TipText>
                Above 1.00 the output is much longer than the text in the image: a repetition loop or invented text.
                Counted as a failure.
              </TipText>
            </TipCard>
          ))}
        >
          <span className="swatch heat-fail">✕</span>
          above 1.00, failed
        </span>
        <span
          className="legend-item"
          tabIndex={0}
          {...tip(() => (
            <TipCard eyebrow="Marker" title="Best open model">
              <TipText>The lowest score among the open candidates shown. Gemini is the reference and is not marked.</TipText>
            </TipCard>
          ))}
        >
          <span className="swatch swatch-best" />
          best open model
        </span>
        <span
          className="legend-item"
          tabIndex={0}
          {...tip(() => (
            <TipCard eyebrow="Marker" title="↻ Repetition loop">
              <TipText>
                The model repeated the same phrase until it stopped or hit its token limit. The loop-cut score in the
                leaderboard shows the result with the loop removed.
              </TipText>
            </TipCard>
          ))}
        >
          ↻ repetition loop
        </span>
        <span
          className="legend-item"
          tabIndex={0}
          {...tip(() => (
            <TipCard eyebrow="Marker" title="⚠ Training overlap">
              <TipText>
                The model&apos;s card lists this image&apos;s source dataset in its training data, so it may have seen
                this exact image. Treat the score as unreliable.
              </TipText>
            </TipCard>
          ))}
        >
          ⚠ trained on this image&apos;s source
        </span>
        <span className="legend-item">
          <RoundBadge round={1} /> <RoundBadge round={2} /> round tested
        </span>
      </div>
    </div>
  )
}
