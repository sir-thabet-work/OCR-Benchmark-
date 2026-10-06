# Arabic OCR Test Set (10 images)

A small, deliberately varied test set for a first comparison of the models in [search_methdology.md](../search_methdology.md).
Each image covers a different failure mode from Section 2 (cursive script, diacritics, RTL/LTR mixing, layout, handwriting, quality).

Every image has a matching `*.gt.txt` file holding the dataset's ground truth (UTF-8). `manifest.csv` lists the source and size of each image.

| # | File | Scenario | What it stresses | Source dataset |
|---|------|----------|------------------|----------------|
| 01 | `01_printed_book_page.png` | Clean printed book page | Full-page reading order, long text | KITAB-Bench / Hindawi |
| 02 | `02_handwritten_paragraph.jpg` | Modern handwriting (paragraph) | Cursive handwriting, multi-line | KITAB-Bench / KHATT paragraph |
| 03 | `03_historical_manuscript.jpg` | Historical manuscript page | Old script, partial tashkeel, aged paper | KITAB-Bench / Historical Books |
| 04 | `04_handwritten_archive_line.jpg` | Handwritten archive line | Single handwritten line, names | KITAB-Bench / Muharaf |
| 05 | `05_scene_text_photo.jpg` | Scene text (photo of a sign) | Natural image, decorative font | KITAB-Bench / EvArEST |
| 06 | `06_table.jpg` | Table | Structure output (HTML/Markdown), Arabic + English names, Arabic-Indic digits | KITAB-Bench / Tables |
| 07 | `07_diacritics_tashkeel.jpg` | Fully vocalized text | Diacritics preservation | KITAB-Bench / SynthesizeAr |
| 08 | `08_darija_moroccan.jpg` | Moroccan Darija | Dialect vocabulary | atlasia/darija-ocr-annotated |
| 09 | `09_invoice_mixed_degraded.jpg` | Invoice, photo-degraded | RTL + LTR mixing, Latin IDs, Arabic-Indic numbers, low contrast | KhalfounMehdi/arabic-latin-invoices-synthetic |
| 10 | `10_presentation_slide_text.jpg` | Slide / screen text line | Digital-born text, very small height (24 px) | KITAB-Bench / ISI-PPT |

## Notes

- **Ground truth format differs by item.** `06_table.gt.txt` is HTML and `09_invoice_mixed_degraded.gt.txt` is Markdown; the rest are plain text. Normalize (Section 6, step 5) before computing CER/WER.
- **Legal documents are not covered.** No public Arabic legal dataset with images and ground truth was found; add your own legal scans if that is the target use case.
- **10 images is a smoke test only**, enough to spot hallucination/repetition failures and rule out weak models, not to rank close candidates (the plan calls for 150–300).
