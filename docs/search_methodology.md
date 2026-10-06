# Arabic OCR Model Research: Search Methodology & Findings

> **Goal:** find and evaluate the best OCR models for Arabic, and document *how* I searched, not just *what* I found.

---

## 1. Methodology at a Glance

```
Understand the problem  →  Map the contributors  →  Reframe the task  →  Cross-validate  →  Test
   (OCR vs VLM)            (who builds Arabic OCR)    (generic vs specific)  (curated lists)     (own data) 
```

| Step | Question I asked | Output |
|------|------------------|--------|
| 1. Understand | How does OCR work, what are its limits, and why are VLMs replacing it? | Clear problem framing |
| 2. Map contributors | Who is actively building Arabic OCR? | Shortlist from my own search, also confirmed in my saved library |
| 3. Reframe | Is this a *generic* or a *specific* OCR task? | Key insight: model size depends on task scope |
| 4. Cross-validate | Does an independent curated list agree with my findings? | Confirmation and extra candidates |
| 5. Test | Which model actually wins on *my* data? | Evaluation plan (Section 6) |

---

## 2. Step 1: Understanding the Problem

### How traditional OCR works

Traditional OCR engines (Tesseract, EasyOCR, classic PaddleOCR) process an image as a pipeline of separate stages:

1. **Preprocessing.** Clean the image: grayscale, binarization, denoising, and deskewing.
2. **Text detection.** Find the regions of the image that contain text (blocks, lines, words).
3. **Segmentation.** Split the detected lines into words and characters.
4. **Recognition.** Classify each character or line into text, using a CNN or CNN+LSTM model with CTC decoding in modern engines.
5. **Post-processing.** Fix the output with dictionaries or language models, then reassemble the reading order.

Each stage depends on the one before it, so an error early in the pipeline (for example, a bad segmentation) carries through to the final text.

### Why traditional OCR struggles with Arabic

Arabic breaks this pipeline in several ways:

- **Cursive, connected script.** A letter's shape changes with its position (initial, medial, final, isolated), so character segmentation is fragile.
- **Diacritics (tashkeel) and dots.** Small marks change meaning and are easy to drop or confuse.
- **Right-to-left text mixed with left-to-right numbers and Latin text.** Bidirectional ordering errors are common.
- **Font and calligraphy diversity**, plus elongation (tatweel), ligatures, and handwriting.
- **Layout.** Tables, multi-column pages, and forms are lost when the output is plain text.

### Why VLMs

Vision-language models read the whole image in context and generate text directly. This avoids fragile segmentation, uses language knowledge to resolve ambiguous glyphs, and can output structure (Markdown, HTML tables).

**Trade-off:** VLMs are heavier and can *hallucinate* or get stuck in repetition loops, which is a failure mode traditional OCR doesn't have. This must be tested for.

---

## 3. Step 2: Mapping the Arabic Contributors

I searched for the Arabic contributors who are actively shipping OCR models on Hugging Face, and built a shortlist from what I found.

When I checked my saved library afterwards, the same contributors and models were already there. I keep this library by saving AI resources I come across in GitHub repos, LinkedIn, X, and from following contributors directly. The overlap confirmed that the search had reached the right people.

The pattern I noticed: **contributors don't train from scratch.** They take a strong, small open VLM base (Qwen2-VL, Qwen2.5-VL, Gemma, GLM-OCR, PaddleOCR-VL) and **fine-tune it for one specific Arabic OCR task.**

---

## 4. Step 3: Reframing the Task (Key Insight)

The task "best Arabic OCR model" turned out to be **too generic**. The right model depends on scope:

| Task scope | Best fit | Why |
|-----------|----------|-----|
| **Generic OCR** (any document, any layout, any quality) | Large / frontier models (Gemini, GPT, Mistral OCR) | Generalization needs scale; frontier models already cover the long tail |
| **Specific OCR** (legal documents, handwriting, printed books, one dialect) | Small fine-tuned models (≈1–4B) | A narrow domain can be learned well by a small model: cheaper, faster, self-hostable, private |

> **Conclusion:** Treat frontier models as the *generic baseline / upper bound*, and look for small specialized models for each concrete use case.

---

## 5. Findings: Organized Resources

### 5.1 Specialized models found in my search (and confirmed in my saved library)

| Model | Contributor | Specialty | Base | Link |
|-------|-------------|-----------|------|------|
| arabic-legal-documents-ocr-1.0 | Abu Bakr Soliman (bakrianoo) 🇪🇬 | Legal documents | Gemma (~4.3B) | [HF](https://huggingface.co/bakrianoo/arabic-legal-documents-ocr-1.0) |
| Qari-OCR-0.1-VL-2B-Instruct | NAMAA-Space 🇸🇦 | General printed Arabic (Qari series) | Qwen2-VL 2B | [HF](https://huggingface.co/NAMAA-Space/Qari-OCR-0.1-VL-2B-Instruct) |
| Arabic-handwritten-OCR-4bit-Qwen2.5-VL-3B-v2 | sherif1313 | Handwriting | Qwen2.5-VL 3B (4-bit) | [HF](https://huggingface.co/sherif1313/Arabic-handwritten-OCR-4bit-Qwen2.5-VL-3B-v2) |

### 5.2 Cross-validation: Hesham Haroon's curated list

After finishing my own search, I found that **Hesham Haroon** (h9-tec) also maintains a curated collection of Arabic AI resources, the [Arabic AI Atlas](https://github.com/h9-tec/arabic-ai-atlas), which includes an OCR section.

- ✅ **His list contains the same models I found**, which independently confirms my search.
- ➕ **New from his list:** I took the **Egyptian contributions** as additional candidates.

#### Egyptian contributions (from the atlas) 🇪🇬

| Model / Tool | Contributor | Specialty | Link |
|--------------|-------------|-----------|------|
| arabic-legal-documents-ocr-1.0 | bakrianoo | Legal documents (also in my search) | [HF](https://huggingface.co/bakrianoo/arabic-legal-documents-ocr-1.0) |
| Katib-Qwen3.5-0.8B-0.1 | oddadmix | Small general Arabic OCR (0.8B) | [HF](https://huggingface.co/oddadmix/Katib-Qwen3.5-0.8B-0.1) |
| waqf-ocr-hand-written-v1 | Waqf AI | Handwriting (fine-tuned from PaddleOCR-VL-1.6 on KHATT) | [HF](https://huggingface.co/Waqf-AI/waqf-ocr-hand-written-v1) |
| Manazir OCR | h9-tec | Arabic-first multi-model OCR pipeline | [GitHub](https://github.com/h9-tec/Manazir-OCR) |

#### Other countries: use when the use case fits

| Model | Contributor | Specialty | Link |
|-------|-------------|-----------|------|
| Qari-OCR-0.4.0-VL-4B-Instruct | NAMAA-Space 🇸🇦 | Latest Qari, printed text | [HF](https://huggingface.co/NAMAA-Space/Qari-OCR-0.4.0-VL-4B-Instruct) |
| Baseer | Misraj AI 🇸🇦 | Document → Markdown (structure-aware) | [HF](https://huggingface.co/Misraj/Baseer-Qwen2.5-VL-3B-Instruct) |
| AtlasOCR | atlasia 🇲🇦 | Moroccan Darija | [HF](https://huggingface.co/atlasia/AtlasOCR) |
| DIMI-Arabic-OCR | AhmedZaky1 | Printed text with diacritics | [HF](https://huggingface.co/AhmedZaky1/DIMI-Arabic-OCR) |
| arabic-large-nougat | MohamedRashad | Structured OCR for Arabic books | [HF](https://huggingface.co/MohamedRashad/arabic-large-nougat) |
| arabic_PP-OCRv5_mobile_rec | PaddlePaddle | Lightweight text-line recognition (non-VLM baseline) | [HF](https://huggingface.co/PaddlePaddle/arabic_PP-OCRv5_mobile_rec) |

---

## 6. Step 5: Testing Plan

> Full details: [evaluation_strategy.md](evaluation_strategy.md).

1. **Define the use case first.** Pick the document type (legal, handwriting, printed books, forms), because Step 3 showed the winner depends on it.
2. **Build a test set** of 150–300 real images with verified ground truth.
3. **Candidates:** 3–5 specialized models matching the use case, plus one frontier model (e.g. Gemini) as the upper bound.
4. **Fixed protocol:** the same images for every model, greedy decoding, each model's documented prompt, and pinned model versions.
5. **Metrics:**
   - CER and WER after Arabic normalization (NFC, strip tatweel and bidi marks, unify digits)
   - Failure rate (pages with CER > 1.0 indicate hallucination or repetition loops)
   - Latency and VRAM per page; cost per 1,000 pages
6. **Decide:** the best accuracy within the hardware and cost budget, not just the top leaderboard score.

---

## 7. Key Takeaways

- Traditional OCR fails on Arabic mainly because of segmentation; VLMs fix this but add hallucination risk.
- **"Best Arabic OCR" depends on the task:** generic → frontier models; specific → small fine-tuned models.
- The Arabic community's pattern is a **small strong base model + task-specific fine-tuning**.
- An independent curated list (Arabic AI Atlas) confirmed my findings and added Egyptian contributions.
- The final decision comes from **testing on my own data**.