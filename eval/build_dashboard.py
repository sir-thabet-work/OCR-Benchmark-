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
}

LATENCY_CAVEATS = {
    "gemini": "Measured from a home connection; retry waits excluded.",
    "katib": "Pessimistic: the fast attention kernels were not installed.",
    "baseer": "Low because it stops after one line.",
    "waqf": "Slow transformers 4.57 code path.",
    "legal": "4-bit weights with fp32 compute on the T4.",
}

FINDINGS = [
    dict(title="Gemini sets the ceiling",
         body="Median CER 0.157 and no failures. On the printed page it scores 0.007, "
              "against 0.302 for the best open model."),
    dict(title="Katib and Qari tie for best open model",
         body="Median CER 0.178 and 0.180. Qari leads on printed pages and the table; Katib leads on "
              "handwriting lines, tashkeel and Darija, with a fifth of the memory."),
    dict(title="Repetition loops decide the ranking",
         body="Qari, Katib and Sherif fail only by repeating text until they stop or hit the token "
              "limit. A loop guard could reorder the top four."),
    dict(title="CER misjudges tables",
         body="Gemini got every word of the table right but scored 0.581, because it wrote the columns "
              "right to left. Tables and forms need a structure review."),
    dict(title="Scores may be optimistic",
         body="8 of 10 images come from KITAB-Bench training splits that models may have seen. "
              "The next round should use our own documents."),
]

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
        models.append(dict(
            id=mid, round=m.get("round", 1), **info, latencyCaveat=LATENCY_CAVEATS.get(mid),
            precision=m["info"].get("precision"), repo=m["info"].get("repo"),
            summary=dict(cerMean=s["cer_mean"], cerMedian=s["cer_median"], cerP95=s["cer_p95"],
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
