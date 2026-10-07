import { useCallback, useState } from 'react'
import { data } from './lib.js'
import { Findings, ModelCards, StatTiles } from './components/Overview.jsx'
import Leaderboard from './components/Leaderboard.jsx'
import Heatmap from './components/Heatmap.jsx'
import SpeedChart from './components/SpeedChart.jsx'
import Explorer from './components/Explorer.jsx'

function Section({ id, title, lede, children }) {
  return (
    <section id={id} className="section" aria-labelledby={`${id}-h`}>
      <header className="section-head">
        <h2 id={`${id}-h`}>{title}</h2>
        {lede && <p className="lede">{lede}</p>}
      </header>
      {children}
    </section>
  )
}

export default function App() {
  const [imageId, setImageId] = useState(data.images[0].id)
  const [focusModel, setFocusModel] = useState(null)

  const openOutputs = useCallback((img, model) => {
    setImageId(img)
    setFocusModel(model ?? null)
    if (!model) document.getElementById('outputs')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // From a model card or leaderboard row: show that model's worst image.
  const pickModel = useCallback(
    (id) => {
      const m = data.models.find((x) => x.id === id)
      const worst = data.images.reduce((a, b) => (m.outputs[b.id].cer > m.outputs[a.id].cer ? b : a))
      openOutputs(worst.id, id)
    },
    [openOutputs],
  )

  const run = new Date(data.generatedAt)

  return (
    <div className="page">
      <header className="masthead">
        <p className="eyebrow">Round 1 · smoke test · scored {run.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        <h1>Arabic OCR Benchmark</h1>
        <p className="masthead-lede">
          Six open Arabic OCR models and a Gemini reference, run on the same 10 test images and scored against
          verified ground truth. Lower error is better.
        </p>
        <nav className="toc" aria-label="Sections">
          <a href="#models">Models</a>
          <a href="#findings">Findings</a>
          <a href="#leaderboard">Leaderboard</a>
          <a href="#heatmap">Per image</a>
          <a href="#speed">Speed</a>
          <a href="#outputs">Outputs</a>
          <a href="#method">Method</a>
        </nav>
        <StatTiles />
      </header>

      <main>
        <Section
          id="models"
          title="Where each model stands"
          lede="Ranked by median CER. Select a model to see its weakest image."
        >
          <ModelCards onPick={pickModel} />
        </Section>

        <Section id="findings" title="What round 1 shows">
          <Findings />
        </Section>

        <Section
          id="leaderboard"
          title="Leaderboard"
          lede="All ten images, averaged. Select a column to sort. Median CER is the headline: the mean is pulled up by a single loop."
        >
          <Leaderboard onPick={pickModel} />
        </Section>

        <Section
          id="heatmap"
          title="Error on every image"
          lede="Each cell is one model reading one image. Select a cell to compare that image's outputs."
        >
          <Heatmap onSelect={openOutputs} />
        </Section>

        <Section
          id="speed"
          title="Accuracy against speed"
          lede="Median CER against median seconds per page. Points toward the bottom left are better."
        >
          <SpeedChart onPick={pickModel} />
        </Section>

        <Section
          id="outputs"
          title="Read the outputs"
          lede="Pick a test image to see what every model wrote, best first. Repetition loops are marked where they begin."
        >
          <Explorer imageId={imageId} setImageId={setImageId} focusModel={focusModel} />
        </Section>

        <Section id="method" title="How the scores work">
          <div className="method">
            <dl className="defs">
              <div>
                <dt>CER</dt>
                <dd>
                  Character error rate: character edits needed to turn the output into the ground truth, divided by
                  the ground-truth length. 0 is perfect.
                </dd>
              </div>
              <div>
                <dt>No diacritics</dt>
                <dd>The same CER with tashkeel removed from both sides. The gap shows how well a model keeps diacritics.</dd>
              </div>
              <div>
                <dt>WER</dt>
                <dd>Word error rate, the same idea counted in words.</dd>
              </div>
              <div>
                <dt>Failure</dt>
                <dd>{data.failureRule}. A CER above 1.0 means the output is much longer than the text in the image.</dd>
              </div>
              <div>
                <dt>Normalization</dt>
                <dd>{data.normalization}.</dd>
              </div>
            </dl>
            <div className="caveats">
              <h3>Read with care</h3>
              <ul>
                <li>Ten images is a smoke test. One image moves a model&apos;s mean a lot.</li>
                <li>
                  8 of 10 images come from KITAB-Bench training splits, so models trained on those sources may score
                  better than they would on new documents.
                </li>
                <li>
                  CER depends on reading order. A table read correctly with its columns in another order scores badly;
                  tables and forms need a structure review.
                </li>
                <li>Open models ran on a Colab T4 in fp16 (Legal and Sherif in 4-bit). Latency and memory are T4 numbers.</li>
                <li>The reference is Gemini 3.7 Flash; the newer 3.8 Flash was overloaded at run time.</li>
                <li>Cost per 1,000 pages has not been computed yet.</li>
              </ul>
            </div>
          </div>
        </Section>
      </main>

      <footer className="footer">
        Generated from <code>results/results.json</code> by <code>eval/build_dashboard.py</code>. Full notes in{' '}
        <code>docs/round1_notes.md</code>.
      </footer>
    </div>
  )
}
