# Arabic OCR Evaluation Strategy

> **Goal:** compare the candidate models from the [search methodology](search_methodology.md) on the same images, with the same metrics, so the choice is based on measured results and not on leaderboard claims.

---

## 1. Strategy at a Glance

```
Ground truth  →  Run every model  →  Score automatically  →  Judge what metrics miss  →  Decide
 (gold set)      (same images,        (CER, WER,              (LLM-as-judge with          (accuracy within
                  same protocol)       reliability, cost)      a fixed rubric)             hardware & cost budget)
```

---

## 2. Ground Truth: Two Ways to Build It

Every model is scored against a **gold set**: each image in the test folder paired with its verified, standard text output. There are two ways to get that text.

| | **Route A: Public test dataset** (used now) | **Route B: Frontier model (Gemini) + human review** |
|---|---|---|
| Where the text comes from | Annotations shipped with a public benchmark | Gemini transcribes the image, then I review and correct it |
| Cost / effort | Free, already verified | API cost + manual review time per image |
| Covers my real documents? | Only if a public dataset matches the use case | Yes, works on any image |
| Status for this round | ✅ Used | ⏭️ Skipped (documented for later) |

### Route A: Public test dataset (current round)

The 10-image smoke-test set in [test_images/](../test_images/) already has verified ground truth from public datasets, so Gemini is **not needed to build the gold set** this round.

- Images and ground truth: [test_images/](../test_images/) (`NN_name.ext` + `NN_name.gt.txt`)
- Sources and links for every image: [test_images/manifest.md](../test_images/manifest.md)
- Main source: **KITAB-Bench** subsets on Hugging Face ([ahmedheakl/arocrbench_*](https://huggingface.co/ahmedheakl)), plus [atlasia/darija-ocr-annotated](https://huggingface.co/datasets/atlasia/darija-ocr-annotated) and [KhalfounMehdi/arabic-latin-invoices-synthetic](https://huggingface.co/datasets/KhalfounMehdi/arabic-latin-invoices-synthetic)

Gemini is still run in this round, but **as a candidate (upper-bound baseline)**, not as the source of truth.

### Route B: Gemini as ground-truth builder (when we use it)

**When:** use Route B as soon as the test images have no ready ground truth:

- **Our own documents.** Real production scans (for example legal documents, which no public dataset covers with images).
- **A use case no public dataset matches** (a specific form, a specific dialect, a specific print style).
- **Scaling up** from the 10-image smoke test to the full 150–300 image test set, built from real data.

**How:**

1. **Frontier draft.** Gemini converts each image to text with one fixed prompt and a fixed output format (plain text, Markdown for tables).
2. **Human review.** I review every output against the image and correct it. Until it is reviewed, the text is a *silver* label, not gold.
3. **Standardize.** Save the corrected text next to its image as `NN_name.gt.txt`, the same layout as Route A, so the scoring code is identical for both routes.

**Caution:** when the gold set comes from Gemini, Gemini's own score is biased in its favor (it is compared against its own corrected output). In Route B, report Gemini separately, or use a different frontier model as the baseline.

---

## 3. Test Protocol

Every model gets the same conditions, so differences come from the model only:

- **Same images** for every model.
- **Greedy decoding** (temperature 0), with a fixed max-token limit.
- **Each model's documented prompt** (from its model card).
- **Pinned versions**: model revision, quantization, and library versions recorded with the results.
- **Same hardware** for all self-hosted models, so latency and memory are comparable.

### Candidate models

Six specialized models (found in the [search methodology](search_methodology.md#5-findings-organized-resources)), each chosen to answer a specific question:

| # | Model | Contributor | Size | What it tests | Link |
|---|-------|-------------|------|---------------|------|
| 1 | Qari-OCR-0.4.0-VL-4B-Instruct | NAMAA-Space 🇸🇦 | 4B | Latest version of the best-known Arabic OCR series; strong general printed text | [HF](https://huggingface.co/NAMAA-Space/Qari-OCR-0.4.0-VL-4B-Instruct) |
| 2 | Baseer__Nakba | Misraj AI 🇸🇦 | 3B | Baseer adapted to historical handwriting; 1st place in the NAKBA 2026 HTR competition (see note below) | [HF](https://huggingface.co/Misraj/Baseer__Nakba) |
| 3 | arabic-legal-documents-ocr-1.0 | bakrianoo 🇪🇬 | ~4.3B | Whether domain fine-tuning beats general models on its own domain | [HF](https://huggingface.co/bakrianoo/arabic-legal-documents-ocr-1.0) |
| 4 | Katib-Qwen3.5-0.8B-0.1 | oddadmix 🇪🇬 | 0.8B | The smallest option: how far a sub-1B model can go | [HF](https://huggingface.co/oddadmix/Katib-Qwen3.5-0.8B-0.1) |
| 5 | waqf-ocr-hand-written-v1 | Waqf AI 🇪🇬 | ~1B | Handwriting specialist on a newer base (PaddleOCR-VL) | [HF](https://huggingface.co/Waqf-AI/waqf-ocr-hand-written-v1) |
| 6 | Arabic-handwritten-OCR-4bit-Qwen2.5-VL-3B-v2 | sherif1313 | 3B (4-bit) | A second handwriting specialist, quantized; compare against #5 | [HF](https://huggingface.co/sherif1313/Arabic-handwritten-OCR-4bit-Qwen2.5-VL-3B-v2) |

Plus one reference point that is not part of the six:

- **Gemini**: frontier upper bound.

**Notes from the model cards** (checked 2026-10-06):

- **Baseer (#2):** the structure-aware `Misraj/Baseer-Qwen2.5-VL-3B-Instruct` (document → Markdown) is no longer public; Misraj now offers it only through the hosted product at [baseerocr.com](https://baseerocr.com/). The only open Baseer weights are **Baseer__Nakba**, the same 3B Baseer further trained for historical handwriting. It is tested in this slot, so it no longer tests structure output. Its settings come from Misraj's [Nakba-pipeline](https://github.com/misraj-ai/Nakba-pipeline).
- **Legal model (#3):** answers in **JSON**, and its card makes preprocessing mandatory (grayscale, max width 1024 px, contrast ×1.5). For CER/WER, all JSON values are joined into plain text; the raw JSON is kept in `NN_name.raw.txt`.
- **Qari (#1) and Katib (#4)** are LoRA adapters; they are loaded on their base models (`Qwen3-VL-4B-Instruct`, `Qwen3.5-0.8B`) and merged.
- **Waqf (#5):** the code in its card points to a repo id that is not public; the weights are in `Waqf-AI/waqf-ocr-hand-written-v1`. It was trained on single text lines.
- **sherif1313 (#6):** the card's `min_new_tokens=50` is dropped, because it forces extra text on short images such as the one-word scene photo.

**What to expect on the 10-image set:** the handwriting models (#2, #5, #6) should lead on images 02, 03 and 04, and may do poorly on the rest. Only Gemini is likely to keep the table (06) and invoice (09) structure. The legal model (#3) has no matching image yet, so it is tested here only as a general model until legal scans are added (Route B).

### How to run

The code is in [eval/](../eval/) and runs on a GPU notebook (Colab or Kaggle):

| File | What it does |
|------|--------------|
| [eval/ocr_eval_colab.ipynb](../eval/ocr_eval_colab.ipynb) | Step-by-step notebook: install, run all seven models, score, show the leaderboard and CER matrix |
| [eval/models.py](../eval/models.py) | How each model is loaded and prompted, following its card |
| [eval/run_models.py](../eval/run_models.py) | Runs models on `test_images/`. Writes `outputs/<model>/NN_name.txt` plus `_run.json` (prompt, model revision, library versions, GPU, latency and VRAM per image, errors) |
| [eval/score.py](../eval/score.py) | Normalizes, computes the metrics in Section 4, writes `results/results.json` |

Each prediction is stored as `outputs/<model_name>/NN_name.txt`, next to its ground truth by file name.

---

## 4. Automatic Scoring

### 4.1 Normalization (before any metric)

Apply the same normalization to the ground truth and to every model output:

- Unicode NFC.
- Remove tatweel (`ـ`) and bidirectional control marks.
- Unify digits (Arabic-Indic `٠١٢…` and Western `012…` mapped to one form).
- Collapse whitespace.
- Strip markup (HTML tags in `06_table`, Markdown syntax in `09_invoice`) for the CER/WER score. Structure is judged separately (Section 5).
- **Diacritics:** report CER **with** diacritics (strict) and **without** diacritics (lenient). The gap shows how well a model keeps tashkeel.

### 4.2 Metrics

| Group | Metric | Definition | Why it matters |
|-------|--------|------------|----------------|
| **Accuracy** | **CER** (primary) | Character edit distance ÷ ground-truth characters | Fine-grained; fits Arabic, where one dot changes a letter |
| | WER | Word edit distance ÷ ground-truth words | Closer to how a reader feels the errors |
| **Reliability** | Failure rate | % of pages with CER > 1.0 (hallucination or repetition loop) **or** empty output | VLM-specific failure mode that the average hides |
| | p95 CER | CER of the worst 5% of pages | Shows the bad tail, not just the mean |
| **Efficiency** | Latency | Seconds per page (median and p95) | Throughput |
| | GPU memory | Peak VRAM per page | Hardware fit |
| | Cost | $ per 1,000 pages (API price, or GPU-hour cost for self-hosted) | Budget fit |

> CER can exceed 1.0 (100%) when a model outputs far more text than exists (repetition loops), which is why CER > 1.0 is used as the failure signal.

Report CER/WER **per scenario** too (printed, handwriting, historical, table, diacritics, dialect, mixed RTL/LTR, …), not only overall: a model can win on printed text and lose on handwriting.

---

## 5. LLM-as-Judge (only for what metrics can't capture)

CER and WER only count characters. They can't tell whether a table kept its rows and columns, or whether text was read in the right order. For those aspects only, use an LLM judge.

**Fixed rubric** (each scored 1–5, same prompt for every model):

| Criterion | Question for the judge |
|-----------|------------------------|
| Table structure | Are rows, columns, and cell contents preserved and aligned? |
| Reading order | Is the text in the correct right-to-left, top-to-bottom order, including multi-column layouts? |
| Mixed-direction text | Are Latin text and numbers embedded correctly inside the Arabic (no flipped order)? |
| Hallucination | Is there any text that does not exist in the image? |

**Calibrate before trusting it:**

1. Score 20–30 samples myself with the same rubric.
2. Compare with the judge's scores (agreement per criterion).
3. Trust the judge only if it agrees closely with me; otherwise adjust the rubric/prompt and repeat.

For the 10-image smoke test, all items are small enough to score by hand. The judge becomes necessary at the 150–300 image scale.

---

## 6. Results Template

| Model | CER ↓ | CER no-diac ↓ | WER ↓ | Failure rate ↓ | p95 CER ↓ | Latency (s/page) ↓ | VRAM (GB) ↓ | $ / 1k pages ↓ | Judge: structure ↑ | Judge: order ↑ |
|-------|-------|---------------|-------|----------------|-----------|--------------------|-------------|----------------|--------------------|----------------|
| Gemini (upper bound) | | | | | | | — | | | |
| Candidate 1 | | | | | | | | | | |
| … | | | | | | | | | | |

---

## 7. Decision Rule

1. Drop any model with a high failure rate, whatever its average CER.
2. Among the rest, keep the models that fit the **hardware and cost budget**.
3. Pick the lowest CER on the **scenarios that match the real use case**, using the judge scores to break ties on structured documents.

The winner is the best accuracy within budget on our data, not the top leaderboard score.
