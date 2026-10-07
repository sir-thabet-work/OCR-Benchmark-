import { useEffect, useRef } from 'react'
import { data, imageById, fmt, secs } from '../lib.js'
import { ErrorPill, StatusChip } from './Chips.jsx'

const GT_FORMAT = { '06': 'HTML source', '09': 'Markdown source' }

function OutputText({ output }) {
  if (!output.text.trim()) return <p className="empty">No output.</p>
  if (!output.loop) {
    return (
      <pre className="ocr" dir="auto">
        {output.text}
      </pre>
    )
  }
  const head = output.text.slice(0, output.loop.keptChars)
  const tail = output.text.slice(output.loop.keptChars)
  return (
    <pre className="ocr" dir="auto">
      {head}
      <span className="loop-break" dir="ltr">
        ↻ repetition loop starts here: {tail.length.toLocaleString()} more characters
      </span>
      <span className="loop-tail">{tail}</span>
    </pre>
  )
}

export default function Explorer({ imageId, setImageId, focusModel }) {
  const img = imageById[imageId]
  const cardRefs = useRef({})

  useEffect(() => {
    if (focusModel && cardRefs.current[focusModel]) {
      cardRefs.current[focusModel].scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [focusModel, imageId])

  const ranked = [...data.models].sort((a, b) => a.outputs[imageId].cer - b.outputs[imageId].cer)

  return (
    <div className="explorer">
      <div className="picker" role="tablist" aria-label="Test image">
        {data.images.map((i) => (
          <button
            key={i.id}
            role="tab"
            aria-selected={i.id === imageId}
            className={`pick ${i.id === imageId ? 'pick-on' : ''}`}
            onClick={() => setImageId(i.id)}
          >
            <span className="pick-num">{i.num}</span>
            <span className="pick-scn">{i.scenario}</span>
          </button>
        ))}
      </div>

      <div className="source" role="tabpanel">
        <figure className="specimen">
          <div className="specimen-img">
            <img src={`./images/${img.file}`} alt={`Test image ${img.num}: ${img.scenario}`} />
          </div>
          <figcaption>
            {img.file} · {img.source}
          </figcaption>
        </figure>
        <div className="gt">
          <div className="gt-head">
            <span className="eyebrow">Ground truth</span>
            {GT_FORMAT[img.num] && <span className="muted">{GT_FORMAT[img.num]}</span>}
          </div>
          <pre className={`ocr ${GT_FORMAT[img.num] ? 'ocr-code' : ''}`} dir="auto">
            {img.gt.trim()}
          </pre>
        </div>
      </div>

      <ol className="outputs">
        {ranked.map((m, i) => {
          const o = m.outputs[imageId]
          return (
            <li
              key={m.id}
              ref={(el) => (cardRefs.current[m.id] = el)}
              className={`out ${focusModel === m.id ? 'out-focus' : ''}`}
            >
              <div className="out-head">
                <span className="out-rank">{i + 1}</span>
                <span className="out-name">{m.name}</span>
                <StatusChip level={m.level}>{m.verdict}</StatusChip>
              </div>
              <div className="out-metrics">
                <span>
                  CER <ErrorPill value={o.cer} />
                </span>
                <span>no diacritics {fmt(o.cerNd)}</span>
                <span>WER {fmt(o.wer)}</span>
                <span>{secs(o.latency)}</span>
                {o.failed && (
                  <StatusChip level="critical">Failed: {o.reasons.join(', ')}</StatusChip>
                )}
                {o.loop && <StatusChip level="warning">Repetition loop</StatusChip>}
              </div>
              <OutputText output={o} />
            </li>
          )
        })}
      </ol>
    </div>
  )
}
