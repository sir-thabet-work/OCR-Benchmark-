# Test Set Manifest

Source of every test image and its ground truth. Each image `NN_name.ext` has its ground truth in `NN_name.gt.txt`, copied from the dataset field listed below.

| # | Image | Scenario | What it stresses | Size (W×H px) | Dataset | Split / row | GT field | GT format |
|---|-------|----------|------------------|---------------|---------|-------------|----------|-----------|
| 01 | [01_printed_book_page.png](01_printed_book_page.png) | Clean printed book page | Full-page reading order, long text | 612 × 792 | [ahmedheakl/arocrbench_hindawi](https://huggingface.co/datasets/ahmedheakl/arocrbench_hindawi) | train / 0 | `text` | Plain text |
| 02 | [02_handwritten_paragraph.jpg](02_handwritten_paragraph.jpg) | Modern handwriting (paragraph) | Cursive handwriting, multi-line | 2411 × 1199 | [ahmedheakl/arocrbench_khattparagraph](https://huggingface.co/datasets/ahmedheakl/arocrbench_khattparagraph) | train / 0 | `answer` | Plain text |
| 03 | [03_historical_manuscript.jpg](03_historical_manuscript.jpg) | Historical manuscript page | Old script, partial tashkeel, aged paper | 579 × 920 | [ahmedheakl/arocrbench_historicalbooks](https://huggingface.co/datasets/ahmedheakl/arocrbench_historicalbooks) | train / 0 | `answer` | Plain text |
| 04 | [04_handwritten_archive_line.jpg](04_handwritten_archive_line.jpg) | Handwritten archive line | Single handwritten line, names | 900 × 60 | [ahmedheakl/arocrbench_muharaf](https://huggingface.co/datasets/ahmedheakl/arocrbench_muharaf) | train / 0 | `text` | Plain text |
| 05 | [05_scene_text_photo.jpg](05_scene_text_photo.jpg) | Scene text (photo of a sign) | Natural image, decorative font | 574 × 260 | [ahmedheakl/arocrbench_evarest](https://huggingface.co/datasets/ahmedheakl/arocrbench_evarest) | train / 12 | `text` | Plain text |
| 06 | [06_table.jpg](06_table.jpg) | Table | Structure output (HTML/Markdown), Arabic + English, Arabic-Indic digits | 1200 × 800 | [ahmedheakl/arocrbench_tables](https://huggingface.co/datasets/ahmedheakl/arocrbench_tables) | train / 0 | `code` | HTML |
| 07 | [07_diacritics_tashkeel.jpg](07_diacritics_tashkeel.jpg) | Fully vocalized text | Diacritics preservation | 639 × 114 | [ahmedheakl/arocrbench_synthesizear](https://huggingface.co/datasets/ahmedheakl/arocrbench_synthesizear) | train / 0 | `text` | Plain text |
| 08 | [08_darija_moroccan.jpg](08_darija_moroccan.jpg) | Moroccan Darija | Dialect vocabulary | 1317 × 568 | [atlasia/darija-ocr-annotated](https://huggingface.co/datasets/atlasia/darija-ocr-annotated) | test / 0 | `extracted_text` | Plain text |
| 09 | [09_invoice_mixed_degraded.jpg](09_invoice_mixed_degraded.jpg) | Invoice, photo-degraded | RTL + LTR mixing, Latin IDs, Arabic-Indic numbers, low contrast | 2260 × 1214 | [KhalfounMehdi/arabic-latin-invoices-synthetic](https://huggingface.co/datasets/KhalfounMehdi/arabic-latin-invoices-synthetic) | test / 1 | `text_md` | Markdown |
| 10 | [10_presentation_slide_text.jpg](10_presentation_slide_text.jpg) | Slide / screen text line | Digital-born text, very small height (24 px) | 642 × 24 | [ahmedheakl/arocrbench_isippt](https://huggingface.co/datasets/ahmedheakl/arocrbench_isippt) | train / 0 | `text` | Plain text |

The `ahmedheakl/arocrbench_*` datasets are the subsets of **KITAB-Bench** (Arabic OCR benchmark). Each row can be reopened in the Hugging Face dataset viewer, or fetched directly:

```
https://datasets-server.huggingface.co/rows?dataset=<dataset>&config=default&split=<split>&offset=<row>&length=1
```

## Notes

- **Ground truth format differs by item.** `06_table.gt.txt` is HTML and `09_invoice_mixed_degraded.gt.txt` is Markdown; the rest are plain text. Normalize before computing CER/WER (see [../docs/evaluation_strategy.md](../docs/evaluation_strategy.md)).
- **Legal documents are not covered.** No public Arabic legal dataset with images and ground truth was found; add your own legal scans if that is the target use case.
- **10 images is a smoke test only**: enough to spot hallucination/repetition failures and rule out weak models, not to rank close candidates (the plan calls for 150–300).
