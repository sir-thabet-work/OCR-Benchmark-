# Round 2 Notes: Six New Models (2026-10-07)

> **Status:** all six round-2 candidates have been run and scored on the same 10 images as round 1, under the [round-2 strategy](evaluation_strategy_round2.md). Results below compare all 13 models from both rounds.

| File | What it holds |
|------|---------------|
| [results/results.json](../results/results.json) | Scores for all 13 models (both rounds), per image and per model, with each model's `round` |
| `outputs/round2/<model>/` | One `.txt` per image (what was scored), `.raw.txt` where the raw output differs (amad thinking blocks), `_run.json` (prompt, token limit, revision, versions, latency, VRAM, thinking flag) |
| [round1_notes.md](round1_notes.md) | Round 1 results and per-model notes |

---

## 1. Setup Used

- **Hardware:** Google Colab, **Tesla T4 (16 GB)**, 2026-10-07, same as round 1.
- **Precision:**
  - amad-vlm6, amad-vlm5, Fanar, AIN: **nf4 language model, 16-bit vision encoder**, fp16 compute.
  - HunyuanOCR: **fp32** (no bf16 on the T4; fp16 risks overflow).
  - dots.ocr: **fp16**.
- **Libraries:** transformers 5.19.0, torch 2.11.0+cu130. **dots.ocr: transformers 4.51.3**, the version its repo pins (see Section 5).
- **Decoding:** greedy. `max_new_tokens=2048`, except **4,096 for amad-vlm6/5** as their cards require. Card prompts and repetition penalties as in the [strategy](evaluation_strategy_round2.md#candidate-models). Model revisions are pinned in each `_run.json`.

---

## 2. Results (13 models, 10 images)

Sorted by median CER. Lower is better. *Failure* = CER > 1.0, empty output, or error. **Median w/o 02, 04** leaves out the two images whose source datasets (KHATT, Muharaf) are in amad-vlm5's training data.

| Model | Round | CER median | CER mean | Median w/o 02, 04 | Loop-cut mean | CER no-diac | WER | p95 CER | Failures | Loops | Latency median (s/page) | Peak VRAM (GB) |
|-------|:-----:|-----------:|---------:|------------------:|--------------:|------------:|----:|--------:|---------:|------:|------------------------:|---------------:|
| **amad-vlm6** (4-bit) | 2 | **0.135** | **0.202** | 0.196 | **0.202** | 0.142 | **0.434** | **0.514** | **0%** | 0 | 19.7 | 10.5 |
| **amad-vlm5** (4-bit) | 2 | 0.149 | 0.208 | 0.176 | 0.208 | 0.172 | 0.446 | 0.541 | **0%** | 0 | 52.8 | 10.5 |
| *Gemini 3.7 Flash (reference)* | 1 | *0.157* | *0.232* | *0.157* | *0.232* | ***0.117*** | *0.443* | *0.611* | *0%* | *0* | *8.7* | *API* |
| Katib | 1 | 0.177 | 0.542 | 0.353 | 0.305 | 0.497 | 0.772 | 1.956 | 10% (06) | 1 | 7.7 | **2.6** |
| Qari | 1 | 0.180 | 0.404 | 0.141 | 0.276 | 0.334 | 0.574 | 1.452 | 10% (09) | 1 | 17.7 | 12.0 |
| HunyuanOCR-1.5 | 2 | 0.240 | 0.502 | 0.241 | 0.502 | 0.489 | 0.597 | 1.599 | 10% (05) | 1 | 8.4 | 6.0 |
| Sherif | 1 | 0.251 | 1.740 | 0.306 | 0.338 | 1.741 | 2.243 | 8.144 | 20% (03, 09) | 2 | 24.1 | 5.0 |
| Fanar-2-Oryx-IVU (4-bit) | 2 | 0.270 | 0.375 | 0.244 | 0.375 | 0.316 | 0.609 | 0.850 | 10% (04) | 0 | 13.5 | 10.5 |
| dots.ocr | 2 | 0.272 | 0.500 | **0.135** | 0.500 | 0.271 | 0.665 | 1.480 | 10% (04) | 0 | 11.7 | 7.4 |
| AIN-7B (4-bit) | 2 | 0.445 | 0.850 | 0.441 | 0.417 | 0.840 | 0.795 | 3.135 | 10% (09) | 1 | 3.6 ⚠️ | 10.5 |
| Waqf | 1 | 0.702 | 0.976 | 0.701 | 0.976 | 0.940 | 1.282 | 2.664 | 30% | 0 | 139.7 | 2.4 |
| Baseer-Nakba | 1 | 0.803 | 0.581 | 0.822 | 0.581 | 0.555 | 0.707 | 0.897 | 0% ⚠️ | 0 | 2.1 ⚠️ | 7.9 |
| Legal | 1 | 1.340 | 1.855 | 1.340 | 1.855 | 1.885 | 1.948 | 4.428 | 70% | 0 | 23.2 | 5.2 |

Bold = best in the column. ⚠️ AIN's and Baseer's latencies are low because they stop after one line on several pages; Baseer's 0% failure rate hides the same thing.

### CER per image (strict, with diacritics)

| Image | Scenario | amad6 | amad5 | Gemini | Katib | Qari | Hunyuan | Fanar | dots | AIN |
|-------|----------|------:|------:|-------:|------:|-----:|--------:|------:|-----:|----:|
| 01 | Printed book page | 0.236 | 0.215 | *0.007* | 0.602 | 0.304 | 0.208 | 0.212 | 0.065 | **0.044** |
| 02 | Handwriting (paragraph) ⚠️ | **0.041** | 0.044 | *0.051* | 0.250 | 0.188 | 0.164 | 0.264 | 0.894 | 0.822 |
| 03 | Historical manuscript | **0.110** | 0.138 | *0.282* | 0.684 | 0.851 | 0.273 | 0.276 | 0.927 | 0.901 |
| 04 | Handwriting (archive line) ⚠️ | 0.114 | 0.159 | *0.636* | **0.045** | 0.432 | 0.864 | 1.068 | 1.932 | 0.068 |
| 05 | Scene text photo | **0.000** | **0.000** | *0.000* | **0.000** | **0.000** | 2.200 | **0.000** | 0.400 | **0.000** |
| 06 | Table | 0.590 | 0.625 | *0.581* | 2.996 | 0.039 | 0.594 | 0.583 | **0.013** | 0.861 |
| 07 | Diacritics (tashkeel) | 0.327 | 0.364 | *0.145* | 0.073 | 0.109 | 0.109 | 0.200 | 0.127 | **0.000** |
| 08 | Darija dialect | 0.155 | 0.069 | *0.168* | 0.105 | 0.172 | **0.063** | 0.067 | 0.143 | 0.838 |
| 09 | Invoice, mixed RTL/LTR, degraded | **0.422** | 0.438 | *0.434* | 0.635 | 1.943 | 0.541 | 0.576 | 0.490 | 4.963 |
| 10 | Slide text line | 0.027 | 0.027 | *0.013* | 0.027 | **0.000** | **0.000** | 0.507 | 0.013 | **0.000** |

Bold = best open model on that image. ⚠️ = training overlap for amad-vlm5/6 (their scores there are not trustworthy).

**Read (13 models, 10 images, so still not a final decision):**

- **amad-vlm6 is the strongest overall:** best median (0.135) and mean (0.202) of all 13 models, below the Gemini reference, with **no failures and no loops**. It is also the only open model that reads the historical manuscript well (03: 0.110, better than Gemini's 0.282).
- **But part of its lead comes from training overlap.** Without 02 and 04, its median rises to 0.196, behind **dots.ocr (0.135)**, **Qari (0.141)** and Gemini (0.157). On the images no model is known to have trained on, it is a strong but not dominant model.
- **amad-vlm5 ≈ amad-vlm6** on this set (median 0.149 vs 0.135), but 2.7× slower (52.8 vs 19.7 s/page) because it thinks on most full pages.
- **dots.ocr is the structure specialist:** best on the table (0.013, the first model to output it in the right column order, as HTML) and second on the printed page (0.065). It fails on handwriting (02, 04).
- **Repetition loops are mostly solved in round 2:** the two amad models, Fanar and dots.ocr had **zero loops**. Only AIN (09) and HunyuanOCR (a harmless tatweel run on 01) looped.
- **Fanar and HunyuanOCR are mid-pack** (median 0.27 and 0.24). Both lose points to chatty preambles rather than misreading (Section 3).
- **AIN is not usable as an OCR model as configured:** it stops after the first line on 4 pages and loops on the invoice.

---

## 3. Per-Model Notes

### amad-vlm6 (#7)
- Best median and mean of all 13 models; no failures, no loops, p95 CER only 0.514.
- Thought (`<think>`) on **one** page only (03), and finished within the budget. This matches its card: the merge cuts amad-vlm5's thinking.
- Its card warned about over-generation on slides and Muharaf handwriting; **that did not happen here** (10: 0.027, 04: 0.114).
- 06 table (0.590): every cell read, but in right-to-left column order, the same CER artifact as Gemini's table.
- Weakest on tashkeel (07: 0.327): it drops most diacritics.
- Needs 10.5 GB peak in 4-bit on the T4; loads in ~4 minutes.

### amad-vlm5 (#8)
- Nearly as accurate as amad-vlm6 (median 0.149) and also loop-free.
- Thought on **5 of 10 pages** (01, 02, 03, 06, 08), and **always finished** within 4,096 tokens: no runaway reasoning on this set. The cost is speed: 52.8 s/page median, the slowest of the usable models.
- Best open model on Darija after Hunyuan and Fanar (08: 0.069).

### dots.ocr (#12)
- **Best table (06: 0.013)**: HTML output in the correct column order, which CER rewards. Second-best printed page (01: 0.065).
- **Hallucinates on handwriting:** on 02 and 04 it writes fluent, fully diacritized text that is not in the image (04: CER 1.932).
- Best median (0.135) on the eight images without amad's training overlap.
- Needed four compatibility fixes to run on the T4 (Section 5).

### HunyuanOCR-1.5 (#9)
- Fast (8.4 s/page) and solid on printed text, Darija (08: 0.063, best open) and slides (10: 0.000).
- **Chinese preamble:** the card's Chinese prompt sometimes makes it answer `图片中的文本内容是：` ("The text content in the image is:") before the text. On the one-word scene photo (05) that alone gives CER 2.2, its only failure. Kept as-is per the protocol.
- Fails on the handwritten archive line (04: 0.864): it reads it as different words.
- 01 ends in a long run of tatweel (`ــــ`), removed by normalization, so it does not count against CER.

### Fanar-2-Oryx-IVU (#11)
- Solid and loop-free (median 0.270, p95 0.850), strong on Darija (08: 0.067) and the printed page (01: 0.212).
- **English preamble:** on the slide (10) it answered `The text in the image reads: "..."`, which alone costs ~0.5 CER there.
- Hallucinates on the archive line (04: CER 1.068, Quran-style diacritized text).
- Its reported strength on manuscripts did not show here (03: 0.276, behind both amad models).

### AIN-7B (#10)
- **Stops after the first line** on 02, 03, 06 and 08, the same failure as Baseer in round 1. The lines it reads are good: best printed page among open models (01: 0.044), perfect tashkeel (07: 0.000).
- Loops on the invoice (09: CER 4.963, 248 s).
- **Verdict so far:** not usable as a general OCR model with a plain prompt.

---

## 4. Caveats on This Round

- **10 images only**, as in round 1: one image moves a mean a lot.
- **Training overlap is the main caveat for the winner.** amad-vlm5's card lists all KHATT and most Muharaf benchmark images in its training data; our 02 and 04 come from those sets, and amad-vlm6 inherits that training. Other models may overlap with other KITAB-Bench sources without saying so.
- **4-bit for four models.** amad-vlm6/5, Fanar and AIN ran with an nf4 language model. Full bf16 might score slightly better.
- **Chatty outputs are scored as-is.** Hunyuan's Chinese preamble and Fanar's English preamble count as errors, per the protocol. A production pipeline would strip them; that would mostly help Hunyuan on 05 and Fanar on 10.
- **CER still depends on reading order:** amad-vlm6 and Fanar read the table (06) correctly but in reverse column order, so their 0.59 there is mostly an artifact.
- **dots.ocr ran on transformers 4.51.3**, the others on 5.19.0. Latency for HunyuanOCR is in fp32, so it would be faster in bf16 on a newer GPU.

---

## 5. Problems Hit During the Run (and Fixes)

| Problem | Fix | Where it lives now |
|---------|-----|--------------------|
| dots.ocr: newer processors add an `mm_token_type_ids` input its remote code rejects | Drop that field before generating | `DotsOCR.predict()` in [models.py](../eval/models.py) |
| dots.ocr: its generation code breaks on transformers 5.x, its processor on 4.57 | Run it alone on **transformers 4.51.3**, the version its repo pins; load with `torch_dtype` | `DotsOCR` docstring and `load()` |
| dots.ocr: its vision encoder forces bf16 input, which clashes with fp16 weights on the T4 | Wrap the encoder call with `bf16=False` when the GPU has no bf16 | `DotsOCR.load()` |
| dots.ocr: transformers 4.51 rejects images under 28 px (slide 10 is 24 px tall) | Pad with white to 28 px, for dots.ocr only | `DotsOCR.pad_to_min()` |
| dots.ocr: vision attention fell back to eager and ran out of memory on the invoice | Set its vision config to its own memory-efficient `sdpa` attention; rerun all 10 images | `DotsOCR.load()` |
| Colab disk filled up (93 of 113 GB) with 7–8B weights | Deleted the shared Hugging Face weight store (`hub/blobs`) after each finished model | Colab session only |

---

## 6. Interim Observations for the Decision

Against the [round-2 decision rule](evaluation_strategy_round2.md#7-decision-rule):

1. **Drop for high failure rate:** Legal, Waqf (round 1) and AIN (stops early, loops). Sherif stays "needs a loop guard."
2. **Hardware fit:** every usable model fits a 16 GB GPU as tested. amad-vlm6/5 need ~10.5 GB in 4-bit; dots.ocr 7.4 GB; Katib 2.6 GB.
3. **Accuracy:** **amad-vlm6** is the best all-round open model on this set, with no loops and the best manuscript reading. On structured pages (tables), **dots.ocr** is clearly better.
4. **Overlap rule:** amad-vlm6 does **not** clearly beat Qari and dots.ocr on the images without its training overlap (median 0.196 vs 0.141 and 0.135). It cannot yet be declared the winner over them; the **Route B test on our own documents** decides.

**Shortlist for the Route B round:** amad-vlm6, dots.ocr, Qari, Katib, plus the Gemini reference. amad-vlm5 only if the extra thinking time turns out to pay off on harder pages.

---

## 7. Next Steps

1. **Structure review by hand** (strategy Section 5) for 06 and 09, all usable models of both rounds.
2. **Strip known preambles** (Hunyuan, Fanar) as a second view, the way the loop-cut score handles loops, to see their reading accuracy alone.
3. **Cost per 1,000 pages** with a T4 price and Gemini's price.
4. **Route B:** build a gold set from our own documents (Gemini draft + human review) and run the shortlist on it. This removes the training-overlap question.
5. **Commit** `outputs/round2/`, `results/`, these notes and the dashboard update.
