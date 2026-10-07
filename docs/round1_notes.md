# Round 1 Notes: All 7 Models Run (2026-10-06 / 07)

> **Status:** all six candidates and the Gemini reference have been run and scored on the 10-image set. Remaining work is cost, the structure review, and committing. See [Next steps](#7-next-steps).

| File | What it holds |
|------|---------------|
| [results/outputs.md](../results/outputs.md) | Every model's raw output next to the ground truth, per image, with CER/WER/latency |
| [results/results.json](../results/results.json) | Full scores (per image and per model) produced by `eval/score.py` |
| `outputs/round1/<model>/` | One `.txt` per image (what was scored), `.raw.txt` where the raw output differs, `_run.json` (prompt, revision, versions, latency, VRAM) |

---

## 1. Setup Used

- **Open models:** Google Colab, **Tesla T4 (16 GB)**, 2026-10-06 (Sherif: 2026-10-07). No bf16, so every model ran in **fp16**, and the legal model (Gemma 3) in **4-bit nf4 with fp32 compute** (see [models.py](../eval/models.py)).
  - Libraries: torch 2.11.0+cu130, transformers 5.18.0 (Waqf: 4.57.6), peft 0.21.2, bitsandbytes 0.50.2, Python 3.13.
  - Decoding: greedy, `max_new_tokens=2048`, each model's card prompt. Model revisions are pinned in each `_run.json`.
- **Gemini reference:** **`gemini-3.7-flash`**, called from a local machine (no GPU needed), 2026-10-07. Temperature 0, default thinking.
  - The newest stable model is `gemini-3.8-flash`, but it returned repeated **503 "high demand"** errors, so the stable model just before it was used.
  - The free-tier quota ran out (**429 RESOURCE_EXHAUSTED**) after 8 images; 09 and 10 were finished with a second key using `--resume`.
  - All 10 images were confirmed to come from 3.7 Flash.
- **Code:** commit `371a946` plus the uncommitted changes listed in [Section 5](#5-problems-hit-during-the-run-and-fixes).

---

## 2. Results (7 models, 10 images)

Sorted by median CER. Lower is better. *Failure* = CER > 1.0, empty output, or error.

| Model | CER mean | CER median | CER no-diac | WER | p95 CER | Failure rate | Latency median (s/page) | Peak VRAM (GB) |
|-------|---------:|-----------:|------------:|----:|--------:|-------------:|-------------------------:|---------------:|
| *Gemini 3.7 Flash (reference)* | ***0.232*** | ***0.157*** | ***0.117*** | ***0.443*** | ***0.611*** | ***0%*** | *8.7* ⚠️ | *API* |
| **Katib** (0.8B) | 0.542 | **0.178** | 0.497 | 0.773 | 1.956 | 10% (06) | 7.7 ⚠️ | **2.6** |
| **Qari** (4B) | **0.404** | 0.180 | **0.334** | **0.574** | 1.452 | 10% (09) | 17.7 | 12.0 |
| Sherif (3B, nf4) | 1.740 | 0.251 | 1.741 | 2.243 | 8.144 | 20% (03, 09) | 24.1 | 5.0 |
| Waqf (~1B) | 0.976 | 0.702 | 0.940 | 1.282 | 2.664 | 30% (03, 04, 09) | 139.7 ⚠️ | 2.4 |
| Baseer-Nakba (3B) | 0.581 | 0.803 | 0.555 | 0.707 | 0.897 | 0% ⚠️ | 2.1 ⚠️ | 7.9 |
| Legal (4B, nf4) | 1.855 | 1.340 | 1.885 | 1.948 | 4.428 | **70%** | 23.2 ⚠️ | 5.2 |

Bold = best open model in that column. ⚠️ = see the caveats in Section 4 before reading this number.

### CER per image (strict, with diacritics)

| Image | Scenario | Gemini | Qari | Katib | Sherif | Baseer | Waqf | Legal |
|-------|----------|-------:|-----:|------:|-------:|-------:|-----:|------:|
| 01 | Printed book page | *0.007* | 0.304 | 0.602 | **0.302** | 0.920 | 0.723 | 1.572 |
| 02 | Handwriting (paragraph) | *0.051* | 0.188 | 0.250 | **0.137** | 0.812 | 0.466 | 0.699 |
| 03 | Historical manuscript | *0.282* | 0.851 | **0.684** | 10.944 | 0.868 | 1.225 | 0.811 |
| 04 | Handwriting (archive line) | *0.636* ⚠️ | 0.432 | **0.045** | **0.045** | 0.273 | 3.841 | 4.614 |
| 05 | Scene text photo | *0.000* | **0.000** | **0.000** | 0.200 | **0.000** | **0.000** | 4.200 |
| 06 | Table | *0.581* ⚠️ | **0.039** | 2.996 | 0.590 | 0.863 | 0.748 | 1.015 |
| 07 | Diacritics (tashkeel) | *0.145* | 0.109 | **0.073** | 0.309 | 0.364 | 0.364 | 1.109 |
| 08 | Darija dialect | *0.168* | 0.172 | 0.105 | **0.092** | 0.849 | 0.662 | 0.899 |
| 09 | Invoice, mixed RTL/LTR, degraded | *0.434* ⚠️ | 1.943 | **0.635** | 4.723 | 0.795 | 1.055 | 2.055 |
| 10 | Slide text line | *0.013* | **0.000** | 0.027 | 0.053 | 0.067 | 0.680 | 1.573 |

Bold = best open model on that image.

**Read so far (all 7 models, but only 10 images, so not a decision yet):**

- **Gemini is the clear upper bound.** It has the best mean CER (0.232), no failures, and near-perfect pages (01: 0.007, 02: 0.051). Its three weakest scores are mostly scoring artifacts, not misreadings (see its notes below).
- **Among the open models, Qari and Katib are clearly ahead.** They tie on median CER (0.18). Qari wins on printed pages and the table (06: 0.039, the only open model that kept the table text). Katib wins on handwriting lines, tashkeel, Darija and the invoice, at about **1/5 of the VRAM** (2.6 vs 12 GB). Katib even beats Gemini on 04, 07 and 08.
- **Gap to the reference:** on full pages Gemini is far ahead (01: 0.007 vs Qari 0.304; 03: 0.282 vs Katib 0.684). On short lines the best open model matches or beats it.
- **Each open leader has one repetition loop:** Qari on the invoice (09) and Katib on the table (06). Both ran until the 2,048-token limit. This is the main reliability risk for both.
- **Sherif is a strong reader with the worst loops.** On the images where it doesn't loop it is the best open model on 01, 02, 04 and 08. But it loops on 03 and 09 (CER 10.9 and 4.7), which gives it the worst mean and p95 of the usable models. Its median (0.251) is 4th.
- The three remaining specialized models (Baseer-Nakba, Waqf, Legal) are not usable on this test set as configured. The reasons are below.

---

## 3. Per-Model Notes

### Gemini 3.7 Flash (reference)
- Best or near-best on 7 of 10 images; no loops, no hallucinated text.
- **Its three highest CERs are mostly scoring artifacts:**
  - **06 table (0.581):** **every** ground-truth word appears in its output. It writes the Markdown table with the columns in right-to-left visual order (`الأعمال المنافسة … الإسم`), while the ground-truth HTML lists them left to right. CER depends on order, so correct content in a different column order scores badly. This is exactly what the structure judge (strategy Section 5) is for.
  - **04 archive line (0.636):** it **adds full tashkeel** that is not in the image. Without diacritics its CER is **0.045**, so the letters are right. The strict score penalizes the invented marks, which is fair for a tashkeel-sensitive use case.
  - **09 invoice (0.434):** partly the same layout-order effect, plus a real mixed-direction error: `INV-76812` came out as `76812-INV`.
- **Thinking is billed as output:** 07 used 1,502 output tokens for a 57-character line. That matters when computing cost per 1,000 pages.
- ⚠️ **Latency** (8.7 s median) is for the successful call only, measured from a home connection; waits for 503/429 retries are excluded.

### Qari 0.4.0 (#1)
- Best overall accuracy among the open models (mean CER 0.404, best WER and no-diacritics CER).
- **Loop on 09 (invoice):** repeats the tax number `٦٤٦٢٤٤٦٢٣` until the token limit (266 s for that page). A repetition penalty or a lower token cap would bound it, but the protocol keeps decoding fixed for all models.
- Historical manuscript (03) is weak (0.851): it adds tashkeel and invents words.
- Heaviest model here: 12 GB peak VRAM on a T4 in fp16.

### Katib 0.8B (#4)
- Best open model on 6 of 10 images, at the smallest size. Very strong on handwriting line 04 (0.045) and Darija (0.105).
- **Loop on 06 (table):** reads the header correctly, then repeats `المراسلة / ٥٠٠٠٠٠` until the token limit.
- On the printed page (01) it adds heavy, mostly wrong tashkeel. That pushes strict CER to 0.602, although the no-diacritics score is better.
- ⚠️ **Latency is pessimistic:** Qwen3.5's linear-attention layers fell back to slow PyTorch code because `flash-linear-attention` and `causal-conv1d` are not installed. With those kernels Katib should be much faster.

### Sherif: Arabic-handwritten-OCR-4bit-Qwen2.5-VL-3B-v2 (#6)
- Pre-quantized nf4 weights with fp16 compute; only 5.0 GB peak VRAM. Card prompt and `repetition_penalty=1.1` kept; the card's `min_new_tokens=50` dropped (see the strategy).
- **Best open model on 4 images:** 01 printed page (0.302), 02 handwritten paragraph (0.137), 04 archive line (0.045, tied with Katib) and 08 Darija (0.092, better than Gemini).
- **Severe loops on 2 images, despite the card's repetition penalty:**
  - 03 historical manuscript: reads the first line, then repeats `وانه كان يحبه` until the token limit (4,097 chars against ~640; CER 10.9).
  - 09 invoice: reads the header fields, then repeats them (2,801 chars; CER 4.7).
- 06 table (0.590): the cell text is read, but the columns are padded with long runs of spaces and come out in right-to-left order, the same order effect as Gemini.
- Small misreads on short items: 05 `بيارة` for `سيارة` (one dot), and 07 drops most tashkeel (strict 0.309, no-diacritics 0.054).
- **Verdict so far:** a good handwriting reader, but not usable without a loop guard (a lower token cap, or detecting and cutting repeated text like Baseer's cleanup).

### Baseer-Nakba (#2)
- **Reads only one line per image**, even on full pages (01: 72 chars against ~1,500). It looks like a line-level model, which matches the NAKBA competition (line-level HTR).
- The lines it does read are good (04: 0.273, 10: 0.067, 05: 0.000).
- ⚠️ Its **0% failure rate and 0.897 p95 are misleading**: it never loops or hallucinates, it just stops early. Its 2.1 s latency is low for the same reason.
- **Fair test needs line segmentation** (split each page into lines, run Baseer per line, join). Check whether Misraj's [Nakba-pipeline](https://github.com/misraj-ai/Nakba-pipeline) includes a segmenter.

### arabic-legal-documents-ocr (#3)
- **70% failure rate.** As its card says, it extracts JSON *details*, not transcriptions: subjects, keywords, English summaries, translations. Flattening the JSON for scoring mixes all of that into the text.
- It also **hallucinates content**: "HELLO" for the Arabic slide (10), `سيجارة` (cigarette) for `سيارة` (car) on 05, and an invoice described as a "music index" (09).
- Ran in nf4 + fp32 on the T4, so its accuracy may be slightly lower than in bf16. That does not explain the off-task outputs.
- **Verdict so far:** not a general OCR model. Keep it only for Route B legal scans, and score only its `full_text` field there instead of all the JSON values.

### Waqf handwriting v1 (#5)
- **Needed two fixes to load at all** (now in [models.py](../eval/models.py)):
  1. `config.json` was saved by PaddleFormers with the language-model settings nested under `text_config`. The repo's config class never unpacks it: `vocab_size` stayed at 32000 instead of 103424, and generation setup crashed (`'dict' object has no attribute 'to_dict'`). The fix flattens `text_config` to the top level.
  2. The repo's code needs **transformers 4.x** (`ROPE_INIT_FUNCTIONS["default"]` is gone in 5.x). On 4.57.6 it calls `create_causal_mask(inputs_embeds=...)` while 4.57 expects `input_embeds`. The fix is a keyword-renaming shim.
- **Setup verified:** on the repo's own `samples/sample_clean_0.png`, the output matches the handwriting in the image. fp16 and fp32 give identical outputs.
- **On our images it hallucinates.** It writes fluent Arabic that has nothing to do with the image (04: a sentence about Chinese home appliances, repeated). It seems to have memorized its training text and fails outside that distribution (small 250×250 crops). Its mid-range CERs (~0.7) come from overlapping common words, not from reading.
- Very slow on the T4 (median 140 s/page) with the 4.57 eager code path.
- **Verdict so far:** not usable on this test set.

---

## 4. Caveats on This Round

- **10 images only.** One image swings a model's mean a lot. Treat this as a smoke test, not a ranking.
- **Possible training-data overlap.** 8 of 10 images come from **KITAB-Bench** (`ahmedheakl/arocrbench_*`), all from row 0 of each subset's *train* split, and several subsets repackage public datasets (KHATT, Muharaf, historical books) that Arabic OCR models commonly train on. Waqf's card names KHATT; Qari and Baseer report KITAB-Bench results. Scores here may be **optimistic** for those models. The 150–300 image round should use our own documents (Route B) or held-out splits, and compare the two.
- **CER depends on reading order.** A table or form read correctly but in a different cell order scores badly (Gemini 06: every word right, CER 0.581). Structured images (06, 09) need the structure judge, not CER alone.
- **T4 / fp16 for every open model** and nf4 for Legal. Latency and VRAM are T4 numbers. Rerun on an L4 or A100 for final efficiency figures.
- **Latency for Katib is inflated** (missing kernels), **for Baseer is deflated** (stops after one line), and **Gemini's** is from a home connection and excludes retry waits.
- **Gemini reference is 3.7 Flash, not the newest 3.8 Flash** (503 overload at run time).
- **Cost per 1k pages** was not computed (no GPU or Gemini prices passed to `score.py`).
- **Table/structure judging (Section 5 of the strategy) is not done yet.**

---

## 5. Problems Hit During the Run (and Fixes)

| Problem | Fix | Where it lives now |
|---------|-----|--------------------|
| Colab's preinstalled `torchao` 0.10 makes the new `peft` refuse to load any LoRA adapter (Qari, Katib) | `pip uninstall -y torchao` after installing requirements | Only in the Colab session; **add to the notebook** |
| Waqf config nested under `text_config` | Flatten in `Waqf.load()` | [models.py](../eval/models.py) |
| Waqf code incompatible with transformers 5.x | Run Waqf alone on `transformers==4.57.6`, then upgrade back | Notebook already documents the pin; the `input_embeds` shim is in `models.py` |
| Colab could not clone the private repo | Repo made public | n/a |
| Running Gemini on Colab spends GPU hours for an API call | `torch` made optional, so Gemini runs locally from a light `.venv` (google-genai, pillow, jiwer; no torch) | [run_models.py](../eval/run_models.py), [models.py](../eval/models.py) |
| Gemini 503 "high demand" and 429 quota errors | Retry with backoff (10/20/40/80/160 s) on 429/500/503; latency counts the successful call only; retries logged per image | `Gemini.predict()` in [models.py](../eval/models.py) |
| A failed run had to redo every image | `--resume` reruns only failed/missing images; `_run.json` is saved after every image | [run_models.py](../eval/run_models.py) |
| A resumed run could mix Gemini models without a trace | Gemini's reported `model_version` is saved per image | `Gemini.predict()` in [models.py](../eval/models.py) |

---

## 6. Interim Observations for the Decision

Against the decision rule in the [evaluation strategy](evaluation_strategy.md#7-decision-rule):

1. **Drop for high failure rate:** Legal (70%) and Waqf (30%, plus hallucinations on the rest). Sherif (20%) is borderline: its failures are loops a guard might fix, not misreading.
2. **Hardware fit:** Katib (2.6 GB) fits almost anything, and Sherif (5.0 GB) fits easily. Qari (12 GB in fp16) needs a 16 GB GPU or quantization.
3. **Accuracy:** Qari and Katib are close, with Sherif strong on handwriting when it doesn't loop. Which one leads depends on the scenario (printed and tables → Qari; handwriting lines, tashkeel, dialect → Katib or Sherif). All three need a guard against repetition loops.
4. **Open vs API:** Gemini is far more accurate on full pages and never looped. Whether an open model is "good enough" depends on the real documents (full pages vs lines) and the cost per 1,000 pages, which is still to be computed.
5. **Open question:** Baseer-Nakba with line segmentation might compete on handwriting. It hasn't had a fair test yet.

---

## 7. Next Steps

1. ~~Run Sherif (#6).~~ Done 2026-10-07 on the T4, from the GitHub code at `371a946` (the Sherif code is unchanged in the local edits).
2. **Add a loop guard and rerun the looping images** (Qari 09, Katib 06, Sherif 03 and 09): for example cut repeated text with Baseer's `clean_repeated_substrings` for every model, and report scores with and without it.
3. **Re-score all 7** with prices: `python eval/score.py --gpu-hourly-usd <T4 price> --gemini-input-usd-per-m <…> --gemini-output-usd-per-m <…>`, then regenerate `results/outputs.md`.
4. **Notebook fixes:** add `pip uninstall -y torchao` after the install step. Note that Waqf takes ~30 min on a T4, and that Gemini can run locally.
5. **Manual structure/reading-order review** (strategy Section 5) for 06 and 09, now that Gemini's output is in.
6. **Optional follow-ups:**
   - Rerun Gemini on `gemini-3.8-flash` when it is less busy (`--resume` makes a partial rerun cheap).
   - Baseer with line segmentation, for a fair handwriting test.
   - Katib with `flash-linear-attention` and `causal-conv1d` installed, for a real latency number.
   - Score the Legal model on its `full_text` field only.
7. **Commit** `outputs/`, `results/`, the code changes and these notes.
