"""Export the benchmark results for the React dashboard in dashboard/.

Usage:
    python eval/build_dashboard.py      # after eval/score.py
    cd dashboard && npm run dev         # or: npm run build

Writes dashboard/src/data/benchmark.json (scores, outputs, ground truth, notes)
and copies the test images to dashboard/public/images/. Editorial text
(verdicts, notes, findings) lives in MODEL_INFO and FINDINGS below; keep it in
step with docs/round1_notes.md.
"""
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_JSON = ROOT / "dashboard" / "src" / "data" / "benchmark.json"
OUT_IMAGES = ROOT / "dashboard" / "public" / "images"

sys.path.insert(0, str(ROOT / "eval"))
from score import find_loop  # noqa: E402

# level: reference | good | warning | critical
MODEL_INFO = {
    "gemini": dict(name="Gemini 3.7 Flash", org="Google", base="API, default thinking", size="API",
                   level="reference", verdict="Reference",
                   note="Upper bound. Near-perfect on full pages and never looped. "
                        "Its table and invoice scores are mostly reading-order artifacts."),
    "katib": dict(name="Katib", org="oddadmix", base="Qwen3.5-0.8B + LoRA", size="0.8B",
                  level="good", verdict="Lead contender",
                  note="Best open model on 6 of 10 images at 2.6 GB. Loops on the table (06)."),
    "qari": dict(name="Qari 0.4.0", org="NAMAA-Space", base="Qwen3-VL-4B + LoRA", size="4B",
                 level="good", verdict="Lead contender",
                 note="Best open mean CER and the only open model that read the table. "
                      "Loops on the invoice (09). Needs 12 GB."),
    "sherif": dict(name="Sherif handwriting v2", org="sherif1313", base="Qwen2.5-VL-3B, 4-bit", size="3B",
                   level="warning", verdict="Needs loop guard",
                   note="Strong on handwriting and Darija, but loops badly on 03 and 09."),
    "baseer": dict(name="Baseer-Nakba", org="Misraj AI", base="Qwen2.5-VL-3B", size="3B",
                   level="warning", verdict="Needs line splitting",
                   note="Reads only the first line of each image. The lines it reads are good."),
    "waqf": dict(name="Waqf handwriting v1", org="Waqf AI", base="PaddleOCR-VL", size="~1B",
                 level="critical", verdict="Not usable",
                 note="Writes fluent Arabic that has nothing to do with the image."),
    "legal": dict(name="Legal documents OCR", org="bakrianoo", base="Gemma-3-4B, 4-bit here", size="4B",
                  level="critical", verdict="Not usable",
                  note="Returns JSON summaries instead of transcriptions, and invents content."),
    # round 2
    "amad6": dict(name="amad-vlm6", org="amad-iq", base="Qwen2.5-VL-7B merge, 4-bit here", size="8B",
                  level="good", verdict="Lead contender",
                  note="Best median of all 13 models, no failures or loops, best manuscript reading. "
                       "Trained on the sources of 02 and 04; without them it trails dots.ocr and Qari."),
    "amad5": dict(name="amad-vlm5", org="amad-iq", base="Qwen2.5-VL-7B, thinking, 4-bit here", size="7B",
                  level="good", verdict="Contender",
                  note="Almost as accurate as amad-vlm6 and loop-free, but 2.7x slower: it thinks on most full pages."),
    "dots": dict(name="dots.ocr", org="rednote / dots-studio", base="1.7B LLM document parser", size="1.7B",
                 level="good", verdict="Structure specialist",
                 note="Best table by far, read in the right column order, and best median without the overlap "
                      "images. Invents text on handwriting."),
    "hunyuan": dict(name="HunyuanOCR-1.5", org="Tencent", base="HunYuan-VL, fp32 here", size="1B",
                    level="warning", verdict="Mid-pack",
                    note="Fast and good on print and Darija, but sometimes answers with a Chinese preamble "
                         "and misreads handwriting."),
    "fanar": dict(name="Fanar-2-Oryx-IVU", org="QCRI", base="Qwen2.5-VL-7B, 4-bit here", size="7B",
                  level="warning", verdict="Mid-pack",
                  note="Steady and loop-free, but adds an English preamble on some images and invents text "
                       "on the archive line."),
    "ain": dict(name="AIN-7B", org="MBZUAI", base="Qwen2-VL-7B, 4-bit here", size="7B",
                level="critical", verdict="Not usable",
                note="Stops after the first line on four pages and loops on the invoice. "
                     "The lines it reads are excellent."),
}

LATENCY_CAVEATS = {
    "gemini": "Measured from a home connection; retry waits excluded.",
    "katib": "Pessimistic: the fast attention kernels were not installed.",
    "baseer": "Low because it stops after one line.",
    "waqf": "Slow transformers 4.57 code path.",
    "legal": "4-bit weights with fp32 compute on the T4.",
    "amad5": "Slow because it reasons before answering on most full pages.",
    "hunyuan": "Measured in fp32 (no bf16 on the T4); faster in bf16.",
    "ain": "Low because it stops after one line on several pages.",
}

FINDINGS = [
    dict(title="amad-vlm6 is the best all-rounder",
         body="Median CER 0.135, the best of all 13 models and below the Gemini reference (0.157), "
              "with no failures and no loops."),
    dict(title="Part of that lead is training overlap",
         body="amad-vlm5/6 trained on the datasets behind images 02 and 04. Without them, dots.ocr (0.135) "
              "and Qari (0.141) beat amad-vlm6 (0.196)."),
    dict(title="dots.ocr reads tables",
         body="It scored 0.013 on the table, the only model to output it in the right column order. "
              "It fails on handwriting."),
    dict(title="Round 2 mostly solved repetition loops",
         body="Round 1's leaders all looped somewhere. In round 2, amad-vlm6/5, Fanar and dots.ocr had none; "
              "only AIN looped on text."),
    dict(title="Our own documents decide",
         body="On public images, overlap blurs the ranking. The shortlist (amad-vlm6, dots.ocr, Qari, Katib) "
              "goes to a test on our own documents."),
]

# Test images whose source dataset a model is known to have trained on (from its card).
OVERLAP = {
    "amad6": ["02_handwritten_paragraph", "04_handwritten_archive_line"],
    "amad5": ["02_handwritten_paragraph", "04_handwritten_archive_line"],
}
FAIR_EXCLUDE = ("02", "04")  # images left out of the "median without overlap" column

SOURCES = {
    "01": "KITAB-Bench · Hindawi", "02": "KITAB-Bench · KHATT paragraph", "03": "KITAB-Bench · historical books",
    "04": "KITAB-Bench · Muharaf", "05": "KITAB-Bench · EvArEST", "06": "KITAB-Bench · tables",
    "07": "KITAB-Bench · SynthesizeAR", "08": "atlasia/darija-ocr-annotated",
    "09": "arabic-latin-invoices-synthetic", "10": "KITAB-Bench · ISI-PPT",
}


def main():
    res = json.loads((ROOT / "results" / "results.json").read_text(encoding="utf-8"))

    OUT_IMAGES.mkdir(parents=True, exist_ok=True)
    images = []
    for stem, t in res["test_set"].items():
        shutil.copy2(ROOT / "test_images" / t["file"], OUT_IMAGES / t["file"])
        images.append(dict(id=stem, num=stem[:2], scenario=t["scenario"], file=t["file"],
                           source=SOURCES.get(stem[:2], ""), gt=t["ground_truth"]))

    models = []
    for mid, m in res["models"].items():
        info = MODEL_INFO.get(mid, dict(name=mid, org="", base="", size="", level="warning",
                                        verdict="Unreviewed", note=""))
        outputs = {}
        for stem, x in m["images"].items():
            loop = find_loop(x["prediction"])
            outputs[stem] = dict(
                cer=x["cer"], cerNd=x["cer_no_diacritics"], wer=x["wer"], latency=x["latency_s"],
                failed=x["failed"], reasons=x["failure_reasons"], text=x["prediction"],
                loop=dict(keptChars=loop[0], unit=loop[1]) if loop else None,
            )
        s = m["summary"]
        fair = sorted(x["cer"] for stem, x in m["images"].items() if stem[:2] not in FAIR_EXCLUDE)
        half = len(fair) // 2
        fair_median = fair[half] if len(fair) % 2 else (fair[half - 1] + fair[half]) / 2
        models.append(dict(
            id=mid, round=m.get("round", 1), **info, latencyCaveat=LATENCY_CAVEATS.get(mid),
            precision=m["info"].get("precision"), repo=m["info"].get("repo"),
            overlap=OVERLAP.get(mid, []),
            summary=dict(cerMean=s["cer_mean"], cerMedian=s["cer_median"], cerP95=s["cer_p95"],
                         cerMedianFair=round(fair_median, 4), cerMeanLoopCut=s["cer_mean_loop_cut"],
                         loops=s["loops"],
                         cerNdMean=s["cer_no_diacritics_mean"], werMean=s["wer_mean"],
                         failureRate=s["failure_rate"], failedImages=s["failed_images"],
                         latencyMedian=s["latency_median_s"], vram=s["peak_vram_gb"],
                         cost=s["cost_per_1k_pages_usd"]),
            outputs=outputs,
        ))
    models.sort(key=lambda m: m["summary"]["cerMedian"])

    data = dict(generatedAt=res["generated_at"], normalization=res["normalization"],
                failureRule=res["failure_rule"], images=images, models=models, findings=FINDINGS)
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")
    loops = sum(1 for m in models for o in m["outputs"].values() if o["loop"])
    print(f"wrote {OUT_JSON.relative_to(ROOT)} ({len(models)} models, {len(images)} images, {loops} loops)")


if __name__ == "__main__":
    main()
