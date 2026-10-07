# Arabic OCR Evaluation Strategy: Round 2

> **Goal:** test six new candidate models under the same protocol as [round 1](evaluation_strategy.md), on the same images and with the same metrics, so their scores are directly comparable with the round-1 leaders (Katib, Qari) and the Gemini reference. The choice stays based on measured results, not on leaderboard claims.

Round 1 results: [round1_notes.md](round1_notes.md). This document follows the same structure as the [round 1 strategy](evaluation_strategy.md) and marks what changes in round 2 with **(new)**.

---

## 1. Strategy at a Glance

```
Ground truth  →  Run every model  →  Score automatically  →  Judge what metrics miss  →  Decide
 (same gold set   (same images,        (CER, WER,              (manual review with         (accuracy within
  as round 1)      same protocol)       reliability, cost,      a fixed rubric)             hardware & cost budget,
                                        loop-cut CER (new))                                  vs round-1 leaders)
```

**What round 2 adds to round 1:**

| Change | Why |
|--------|-----|
| Six new candidates, including 7–8B models | Larger Arabic OCR fine-tunes and two Arabic-tuned general VLMs were not covered in round 1 |
| 7–8B models run in **4-bit** on the free T4 **(new)** | Their bf16 weights (~16.6 GB) do not fit the T4's 15 GB |
| **Loop-cut CER** as a secondary score **(new)** | Round 1 showed that repetition loops, not misreading, decide the open-model ranking |
| **Training-overlap flags** per image **(new)** | Some new models were trained on the datasets our test images come from |
| Round-1 models are **not re-run** | Same images and same scoring code, so their results stay valid |

---

## 2. Ground Truth: Same Gold Set as Round 1

Every model is scored against the **same gold set** as round 1: the 10 images in [test_images/](../test_images/), each paired with its verified text.

| | **Route A: Public test dataset** (used again) | **Route B: Frontier model (Gemini) + human review** |
|---|---|---|
| Where the text comes from | Annotations shipped with a public benchmark | Gemini transcribes the image, then I review and correct it |
| Cost / effort | Free, already verified | API cost + manual review time per image |
| Covers my real documents? | Only if a public dataset matches the use case | Yes, works on any image |
| Status for this round | ✅ Used (same 10 images as round 1) | ⏭️ Still planned for the 150–300 image round |

### Route A: Public test dataset (this round)

- Images and ground truth: [test_images/](../test_images/) (`NN_name.ext` + `NN_name.gt.txt`), unchanged since round 1.
- Sources and links for every image: [test_images/manifest.md](../test_images/manifest.md).
- Main source: **KITAB-Bench** subsets on Hugging Face ([ahmedheakl/arocrbench_*](https://huggingface.co/ahmedheakl)), plus [atlasia/darija-ocr-annotated](https://huggingface.co/datasets/atlasia/darija-ocr-annotated) and [KhalfounMehdi/arabic-latin-invoices-synthetic](https://huggingface.co/datasets/KhalfounMehdi/arabic-latin-invoices-synthetic).

Gemini 3.7 Flash stays the **upper-bound reference** from round 1; it is not re-run.

### Training overlap (new)

Round 1 already noted that 8 of 10 images come from KITAB-Bench *train* splits. Round 2 makes this concrete per model, because some new models list these datasets in their training data:

| Image | Source | Known overlap |
|-------|--------|---------------|
| 02 Handwritten paragraph | KITAB-Bench · KHATT paragraph | amad-vlm5/6: all 200 KHATT benchmark images are in amad-vlm5's training data (its card) |
| 04 Handwritten archive line | KITAB-Bench · Muharaf | amad-vlm5/6: 171 of 200 Muharaf benchmark images are in amad-vlm5's training data |

Scores on flagged images are reported, but **marked as unreliable** for that model, and the decision (Section 7) also compares the models with those images excluded.

### Route B: still the next step

Route B (our own documents, Gemini draft + human review) is unchanged and remains the plan for the 150–300 image round. It is the only way to remove training overlap completely.

---

## 3. Test Protocol

Every model gets the same conditions as round 1, so differences come from the model only:

- **Same images** for every model (the round-1 set).
- **Greedy decoding** (temperature 0), with a fixed max-token limit of **2,048**, raised only where a card requires more **(new: amad, 4,096)**.
- **Each model's documented prompt** (from its model card); models without an OCR prompt share one plain prompt.
- **Card generation settings kept**: repetition penalty only where the card sets one.
- **Pinned versions**: model revision, quantization, and library versions recorded with the results.
- **Same hardware** for all self-hosted models: the free Colab **T4 (16 GB)**, as in round 1.
- **Quantization (new):** models that do not fit in 16-bit run in **nf4 4-bit**, with only the language model quantized; the vision encoder and output layer stay 16-bit, so image reading is not degraded by quantization.

### Candidate models

Six new models (from the round-2 search, checked against each model card on 2026-10-07), each chosen to answer a specific question:

| # | Model | Contributor | Size | What it tests | Link |
|---|-------|-------------|------|---------------|------|
| 7 | amad-vlm6 | amad-iq 🇮🇶 | 8B | Top of the Clouda benchmark; whether merging two Arabic OCR fine-tunes fixes amad-vlm5's runaway thinking | [HF](https://huggingface.co/amad-iq/amad-vlm6) |
| 8 | amad-vlm5 | amad-iq 🇮🇶 | 7B | A *thinking* OCR model (reasons in `<think>` before answering); compare against #7 | [HF](https://huggingface.co/amad-iq/amad-vlm5) |
| 9 | HunyuanOCR-1.5 | Tencent 🇨🇳 | 1B | A small end-to-end OCR specialist from a large lab; best WER on the Clouda benchmark | [HF](https://huggingface.co/tencent/HunyuanOCR) |
| 10 | AIN-7B | MBZUAI 🇦🇪 | 7B | Whether a general Arabic-English VLM competes with OCR specialists | [HF](https://huggingface.co/MBZUAI/AIN) |
| 11 | Fanar-2-Oryx-IVU | QCRI 🇶🇦 | 7B | An Arabic image-understanding model trained on fonts and calligraphy; reported best on aged printed books and manuscripts | [HF](https://huggingface.co/QCRI/Fanar-2-Oryx-IVU) |
| 12 | dots.ocr | rednote / dots-studio 🇨🇳 | 1.7B LLM | A multilingual document parser that keeps reading order; candidate for tables and layout | [HF](https://huggingface.co/dots-studio/dots.ocr) |

Plus the round-1 results used as fixed comparison points (not re-run):

- **Gemini 3.7 Flash**: frontier upper bound.
- **Katib** and **Qari**: the round-1 open-model leaders (median CER ~0.18).
- Qari appears in the round-2 research list as well. It is not re-run: same images, same code. Its weak result on the external benchmark fits its narrow training on printed Islamic books.

**Notes from the model cards** (checked 2026-10-07):

- **amad-vlm6 (#7) and amad-vlm5 (#8):** both use the prompt `Extract the text in the image. Give me the final text, nothing else.`, `repetition_penalty=1.05` and **4,096 new tokens**, because the cards say a smaller budget truncates dense pages. Both may write a `<think>…</think>` block first; only the text after the last `</think>` is scored, and the raw output is kept in `NN_name.raw.txt`. An unfinished `<think>` block (runaway reasoning) gives an empty answer, which counts as a failure. amad-vlm6's own card warns it **over-generates on slides and Muharaf-style handwriting** (our 10 and 04).
- **HunyuanOCR (#9):** the repo root now holds version **1.5**; 1.0 is archived under `v1.0/`. It has a native transformers integration (transformers ≥ 5.13), so it does not need the CUDA 13 / vLLM / flash-attn setup the card also describes. It uses the card's plain extraction prompt `请提取图片中的文字内容。` ("extract the text in the image") and `repetition_penalty=1.08`. Without bf16 on the T4 it runs in **fp32**, since fp16 risks overflow and a 1B model fits easily. **License:** Tencent Hunyuan Community License, not Apache/MIT; read it before commercial use.
- **AIN (#10) and Fanar (#11):** general VLMs whose cards give **no OCR prompt** and no repetition penalty. Both get the same prompt, `Extract all text from the image.`, so they are compared fairly. AIN is built on Qwen2-VL-7B, Fanar on Qwen2.5-VL-7B.
- **dots.ocr (#12):** uses the repo's plain-text prompt (`prompt_ocr`: `Extract the text content from this image.`), not its layout-JSON prompt, so it is scored like the others. Its remote code requires a weights folder **without a dot** in its name, so the weights are downloaded to `DotsOCR/` first. It works best below ~11.3 megapixels; all our images are smaller.
- **Precision on the T4:** #7, #8, #10, #11 in nf4 (language model only); #9 in fp32; #12 in fp16.

**What to expect on the 10-image set:**

- amad-vlm5/6 should be strong on handwriting (02, 04), but those images overlap their training data. The fair test is the other eight. Watch 10 (slides) for amad-vlm6's documented over-generation.
- amad-vlm5 may think for a long time on full pages (01, 02, 03, 06, 09); check that it finishes within 4,096 tokens.
- Fanar should do well on the historical manuscript (03) and the printed book page (01).
- dots.ocr is the most likely open model to keep the table (06) and invoice (09) in reading order.
- AIN is not an OCR specialist; repetition loops are its known risk, and the loop-cut score will show how much they cost it.

### How to run

The code is in [eval/](../eval/) and runs on the free Colab T4, as in round 1:

| File | What it does |
|------|--------------|
| [eval/models.py](../eval/models.py) | How each model is loaded and prompted, following its card. Round-2 classes: `AmadVLM6`, `AmadVLM5`, `Hunyuan`, `AIN`, `Fanar`, `DotsOCR` |
| [eval/run_models.py](../eval/run_models.py) | Runs models on `test_images/`. `round2` runs the six new models; `--resume` reruns only failed or missing images. Writes `outputs/round2/<model>/NN_name.txt` plus `_run.json` (prompt, token limit, model revision, library versions, GPU, latency and VRAM per image, errors) |
| [eval/score.py](../eval/score.py) | Normalizes, computes the metrics in Section 4 (including loop-cut CER), writes `results/results.json` for **all** models from both rounds |
| [eval/build_dashboard.py](../eval/build_dashboard.py) | Exports the results to the React dashboard in [dashboard/](../dashboard/) |

On Colab:

```python
!git clone -q https://github.com/sir-thabet-work/OCR-Benchmark-.git ocr-benchmark
%cd /content/ocr-benchmark
!pip install -q -U -r eval/requirements.txt
!pip uninstall -q -y torchao          # Colab's old torchao breaks peft adapter loading (round-1 lesson)

# small models first, then the 7-8B ones; one process per model
for m in ['hunyuan', 'dots', 'amad6', 'amad5', 'fanar', 'ain']:
    !python eval/run_models.py {m} --resume
```

Then download `outputs/round2/<model>/` for the six models and, locally:

```bash
python eval/score.py
python eval/build_dashboard.py
```

**Lessons from round 1, applied:**

- One process per model, so a crash or out-of-memory error never stops the others.
- `--resume` and per-image logging, so a Colab time-out or disconnect does not lose finished images.
- If a model's remote code fails on the latest transformers (as Waqf did), run that model alone on `transformers==4.57.6`, then upgrade back.
- Thinking models on a T4 in 4-bit are slow: expect roughly 10–40 minutes per 7–8B model. The free daily GPU limit may split the run across two sessions.

Each prediction is stored as `outputs/round2/<model_name>/NN_name.txt`, next to its ground truth by file name.

---

## 4. Automatic Scoring

### 4.1 Normalization (before any metric)

Same as round 1, applied to the ground truth and to every model output:

- Unicode NFC.
- Remove tatweel (`ـ`) and bidirectional control marks.
- Unify digits (Arabic-Indic `٠١٢…` and Western `012…` mapped to one form).
- Collapse whitespace.
- Strip markup (HTML tags in `06_table`, Markdown syntax in `09_invoice`) for the CER/WER score. Structure is judged separately (Section 5).
- **Diacritics:** report CER **with** diacritics (strict) and **without** diacritics (lenient). The gap shows how well a model keeps tashkeel.
- **Thinking blocks (new):** for amad-vlm5/6, everything up to the last `</think>` is removed before scoring, as their cards specify.

### 4.2 Metrics

| Group | Metric | Definition | Why it matters |
|-------|--------|------------|----------------|
| **Accuracy** | **CER** (primary) | Character edit distance ÷ ground-truth characters | Fine-grained; fits Arabic, where one dot changes a letter |
| | WER | Word edit distance ÷ ground-truth words | Closer to how a reader feels the errors |
| | **Loop-cut CER (new)** | CER after cutting a detected repetition loop (a unit repeated 10+ times at the end, the detector from Misraj's Nakba pipeline) | Shows how a model reads when its loops are handled, as a production loop guard would. **Secondary only:** the raw CER stays the headline |
| **Reliability** | Failure rate | % of pages with CER > 1.0 (hallucination or repetition loop) **or** empty output | VLM-specific failure mode that the average hides |
| | **Loops (new)** | Number of outputs with a detected repetition loop | Separates "loops" from "misreads" among the failures |
| | p95 CER | CER of the worst 5% of pages | Shows the bad tail, not just the mean |
| **Efficiency** | Latency | Seconds per page (median and p95) | Throughput |
| | GPU memory | Peak VRAM per page | Hardware fit |
| | Cost | $ per 1,000 pages (API price, or GPU-hour cost for self-hosted) | Budget fit |

> CER can exceed 1.0 (100%) when a model outputs far more text than exists (repetition loops), which is why CER > 1.0 is used as the failure signal.

Report CER/WER **per scenario** too (printed, handwriting, historical, table, diacritics, dialect, mixed RTL/LTR, …), not only overall: a model can win on printed text and lose on handwriting. **(New)** For amad-vlm5/6, also report the median CER **without images 02 and 04**, where their training overlaps.

**Round-1 baseline with the new metric** (already computed, mean CER):

| Model | Raw CER | Loop-cut CER | Loops |
|-------|--------:|-------------:|------:|
| Gemini 3.7 Flash | 0.232 | 0.232 | 0 |
| Qari | 0.404 | 0.276 | 1 |
| Katib | 0.542 | 0.305 | 1 |
| Sherif | 1.740 | 0.338 | 2 |

---

## 5. Structure Review (only for what metrics can't capture)

Same rubric as round 1. CER and WER only count characters; round 1 confirmed why that matters: Gemini read **every word** of the table (06) correctly, but scored CER 0.581 because it wrote the columns in right-to-left order.

**Fixed rubric** (each scored 1–5, same for every model):

| Criterion | Question |
|-----------|----------|
| Table structure | Are rows, columns, and cell contents preserved and aligned? |
| Reading order | Is the text in the correct right-to-left, top-to-bottom order, including multi-column layouts? |
| Mixed-direction text | Are Latin text and numbers embedded correctly inside the Arabic (no flipped order, e.g. `INV-76812` not `76812-INV`)? |
| Hallucination | Is there any text that does not exist in the image? |

For this 10-image round, the structure criteria apply to **06 (table)** and **09 (invoice)**, and are scored **by hand** for every model of both rounds; hallucination is scored on all images. An LLM judge, calibrated against 20–30 hand-scored samples, becomes necessary only at the 150–300 image scale (unchanged from round 1).

---

## 6. Results Template

Round-1 comparison points are filled in; the round-2 rows are filled after the run. Lower is better (↓), higher is better (↑).

| Model | Round | CER (median) ↓ | CER (mean) ↓ | Loop-cut CER (mean) ↓ | CER no-diac ↓ | WER ↓ | Failure rate ↓ | Loops ↓ | p95 CER ↓ | Latency (s/page) ↓ | VRAM (GB) ↓ | $ / 1k pages ↓ | Structure ↑ | Order ↑ |
|-------|:-----:|---------------:|-------------:|----------------------:|--------------:|------:|---------------:|--------:|----------:|-------------------:|------------:|---------------:|------------:|--------:|
| Gemini 3.7 Flash (upper bound) | 1 | 0.157 | 0.232 | 0.232 | 0.117 | 0.443 | 0% | 0 | 0.611 | 8.7 | — | | | |
| Katib | 1 | 0.178 | 0.542 | 0.305 | 0.497 | 0.772 | 10% | 1 | 1.956 | 7.7 | 2.6 | | | |
| Qari | 1 | 0.180 | 0.404 | 0.276 | 0.334 | 0.574 | 10% | 1 | 1.452 | 17.7 | 12.0 | | | |
| amad-vlm6 (4-bit) | 2 | | | | | | | | | | | | | |
| amad-vlm5 (4-bit) | 2 | | | | | | | | | | | | | |
| HunyuanOCR-1.5 | 2 | | | | | | | | | | | | | |
| AIN-7B (4-bit) | 2 | | | | | | | | | | | | | |
| Fanar-2-Oryx-IVU (4-bit) | 2 | | | | | | | | | | | | | |
| dots.ocr | 2 | | | | | | | | | | | | | |

---

## 7. Decision Rule

Same rule as round 1, applied to **all models from both rounds together**:

1. Drop any model with a high failure rate, whatever its average CER. **(New)** If its failures are only repetition loops, keep it as "needs a loop guard" and judge it by its loop-cut CER as a second view.
2. Among the rest, keep the models that fit the **hardware and cost budget**. The 4-bit models fit a 16 GB GPU, as tested.
3. Pick the lowest CER on the **scenarios that match the real use case**, using the structure scores to break ties on structured documents.
4. **(New)** A round-2 model replaces a round-1 leader (Katib, Qari) only if it wins **on the images without training overlap** for that model, not just overall.

The winner is the best accuracy within budget on our data, not the top leaderboard score. Because 8 of 10 images may overlap training data, the final choice still needs the Route B test on our own documents.
