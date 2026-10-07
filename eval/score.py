"""Score model outputs against the ground truth and write results/results.json.

Usage:
    python eval/score.py
    python eval/score.py --gpu-hourly-usd 0.80 --gemini-input-usd-per-m 1.25 --gemini-output-usd-per-m 10

Follows docs/evaluation_strategy.md: normalize both sides, then CER (with and
without diacritics), WER, failure flag (CER > 1.0, empty output, or error),
and per-model summaries (mean, median, p95, failure rate, latency, VRAM, cost).
"""
import argparse
import json
import re
import statistics
import unicodedata
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

import sys

import jiwer

sys.path.insert(0, str(Path(__file__).parent))
from models import clean_repeated_substrings  # noqa: E402

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}

SCENARIOS = {
    "01": "Printed book page",
    "02": "Handwriting (paragraph)",
    "03": "Historical manuscript",
    "04": "Handwriting (archive line)",
    "05": "Scene text photo",
    "06": "Table",
    "07": "Diacritics (tashkeel)",
    "08": "Darija dialect",
    "09": "Invoice, mixed RTL/LTR, degraded",
    "10": "Slide text line",
}

# --- normalization -----------------------------------------------------------

DIACRITICS = re.compile("[ً-ٰٟۖ-ۭ]")
BIDI_MARKS = re.compile("[‎‏؜‪-‮⁦-⁩﻿]")
TATWEEL = "ـ"
DIGITS = str.maketrans(
    "٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹٫٬",
    "01234567890123456789.,",
)
THOUSANDS = re.compile(r"(?<=\d)[،,](?=\d{3})")  # Arabic comma used as a thousands separator
HTML_TAG = re.compile(r"</?(html|body|table|thead|tbody|tr|td|th|div|p|br|span|h[1-6])\b", re.I)


class _TextExtractor(HTMLParser):
    """Keeps visible text; skips <head>, <style>, <script>. Cells and rows become spaces."""

    SKIP = {"head", "style", "script"}

    def __init__(self):
        super().__init__()
        self.parts, self.skip_depth = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip_depth += 1
        self.parts.append(" ")

    def handle_endtag(self, tag):
        if tag in self.SKIP and self.skip_depth:
            self.skip_depth -= 1
        self.parts.append(" ")

    def handle_data(self, data):
        if not self.skip_depth:
            self.parts.append(data)


def strip_markup(text):
    if HTML_TAG.search(text):
        parser = _TextExtractor()
        parser.feed(text)
        text = "".join(parser.parts)
    text = re.sub(r"^\s*```.*$", " ", text, flags=re.M)                 # code fences
    text = re.sub(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$", " ", text, flags=re.M)  # table rules
    text = re.sub(r"^\s*#{1,6}\s+", "", text, flags=re.M)               # headings
    text = re.sub(r"^\s*>\s?", "", text, flags=re.M)                     # quotes
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.M)                 # bullets
    text = text.replace("**", "").replace("__", "").replace("`", "").replace("|", " ")
    return text


def normalize(text, keep_diacritics=True):
    text = unicodedata.normalize("NFC", strip_markup(text))
    text = BIDI_MARKS.sub("", text).replace(TATWEEL, "").translate(DIGITS)
    text = THOUSANDS.sub(",", text)
    if not keep_diacritics:
        text = DIACRITICS.sub("", text)
    return " ".join(text.split())


# --- metrics -----------------------------------------------------------------

def error_rate(fn, reference, hypothesis):
    if not hypothesis:
        return 1.0
    return float(fn(reference, hypothesis))


def find_loop(text):
    """Return (chars before the loop, repeated unit) or None.

    Uses the Nakba pipeline's detector (a unit repeated 10+ times at the end).
    Outputs cut at the token limit end mid-unit, so a short partial tail is
    trimmed first. Pure whitespace padding does not count as a loop.
    """
    text = text.rstrip("�").rstrip()
    for trim in range(40):
        head = text[:len(text) - trim] if trim else text
        kept = clean_repeated_substrings(head)
        if len(kept) < len(head):
            unit = head[len(kept):][:60]
            return (len(kept), unit) if unit.strip() else None
    return None


def percentile(values, q):
    values = sorted(values)
    if not values:
        return None
    k = (len(values) - 1) * q / 100
    lo, hi = int(k), min(int(k) + 1, len(values) - 1)
    return values[lo] + (values[hi] - values[lo]) * (k - lo)


def r(x, n=4):
    return None if x is None else round(x, n)


def score_model(model_dir, images, args):
    run_file = model_dir / "_run.json"
    run = json.loads(run_file.read_text(encoding="utf-8")) if run_file.exists() else {}
    per_image = {}
    for img in images:
        gt = (img.parent / f"{img.stem}.gt.txt").read_text(encoding="utf-8")
        pred_file = model_dir / f"{img.stem}.txt"
        pred = pred_file.read_text(encoding="utf-8") if pred_file.exists() else ""
        meta = run.get("images", {}).get(img.stem, {})

        ref, hyp = normalize(gt), normalize(pred)
        ref_nd, hyp_nd = normalize(gt, False), normalize(pred, False)
        cer = error_rate(jiwer.cer, ref, hyp)
        # secondary score: the same CER after cutting a repetition loop (headline stays raw CER)
        loop = find_loop(pred)
        cer_cut = error_rate(jiwer.cer, ref, normalize(pred[:loop[0]])) if loop else cer
        error = meta.get("error") or (None if pred_file.exists() else "no output file")
        reasons = [why for why, hit in (
            ("error", bool(error)),
            ("empty output", not hyp),
            ("CER > 1.0 (hallucination / repetition)", cer > 1.0),
        ) if hit]
        per_image[img.stem] = {
            "scenario": SCENARIOS.get(img.stem[:2], img.stem),
            "cer": r(cer),
            "cer_no_diacritics": r(error_rate(jiwer.cer, ref_nd, hyp_nd)),
            "wer": r(error_rate(jiwer.wer, ref, hyp)),
            "loop": bool(loop),
            "loop_kept_chars": loop[0] if loop else None,
            "cer_loop_cut": r(cer_cut),
            "failed": bool(reasons),
            "failure_reasons": reasons,
            "latency_s": meta.get("latency_s"),
            "peak_vram_gb": meta.get("peak_vram_gb"),
            "input_tokens": meta.get("input_tokens"),
            "output_tokens": meta.get("output_tokens"),
            "error": error,
            "prediction": pred,
        }

    rows = list(per_image.values())
    cers = [x["cer"] for x in rows]
    latencies = [x["latency_s"] for x in rows if x["latency_s"] is not None]
    vram = [x["peak_vram_gb"] for x in rows if x["peak_vram_gb"] is not None]
    latency_median = statistics.median(latencies) if latencies else None

    cost = None
    if model_dir.name == "gemini":
        if args.gemini_input_usd_per_m is not None and args.gemini_output_usd_per_m is not None:
            per_page = [
                (x["input_tokens"] or 0) * args.gemini_input_usd_per_m / 1e6
                + (x["output_tokens"] or 0) * args.gemini_output_usd_per_m / 1e6
                for x in rows
            ]
            cost = statistics.mean(per_page) * 1000
    elif args.gpu_hourly_usd is not None and latency_median is not None:
        cost = latency_median * 1000 / 3600 * args.gpu_hourly_usd

    summary = {
        "cer_mean": r(statistics.mean(cers)),
        "cer_median": r(statistics.median(cers)),
        "cer_p95": r(percentile(cers, 95)),
        "cer_no_diacritics_mean": r(statistics.mean(x["cer_no_diacritics"] for x in rows)),
        "loops": sum(x["loop"] for x in rows),
        "cer_mean_loop_cut": r(statistics.mean(x["cer_loop_cut"] for x in rows)),
        "cer_median_loop_cut": r(statistics.median(x["cer_loop_cut"] for x in rows)),
        "wer_mean": r(statistics.mean(x["wer"] for x in rows)),
        "failure_rate": r(sum(x["failed"] for x in rows) / len(rows)),
        "failed_images": [k for k, x in per_image.items() if x["failed"]],
        "latency_median_s": r(latency_median, 3),
        "latency_p95_s": r(percentile(latencies, 95), 3),
        "peak_vram_gb": max(vram) if vram else None,
        "cost_per_1k_pages_usd": r(cost, 2),
        "cer_by_scenario": {x["scenario"]: x["cer"] for x in rows},
    }
    info = {k: run.get(k) for k in ("repo", "revision", "precision", "prompt", "max_new_tokens",
                                    "load_seconds", "environment", "load_error")}
    return {"info": info, "summary": summary, "images": per_image}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--images", default="test_images", type=Path)
    ap.add_argument("--outputs", default="outputs", type=Path)
    ap.add_argument("--results", default="results/results.json", type=Path)
    ap.add_argument("--gpu-hourly-usd", type=float, help="GPU price, for self-hosted cost per 1k pages")
    ap.add_argument("--gemini-input-usd-per-m", type=float, help="Gemini price per 1M input tokens")
    ap.add_argument("--gemini-output-usd-per-m", type=float, help="Gemini price per 1M output tokens")
    args = ap.parse_args()

    images = sorted(p for p in args.images.iterdir() if p.suffix.lower() in IMAGE_EXTS)
    # outputs/round<N>/<model>/: model ids are unique across rounds
    model_dirs = sorted((d for r in args.outputs.glob("round*") if r.is_dir() for d in r.iterdir() if d.is_dir()),
                        key=lambda d: (d.parent.name, d.name))
    models = {d.name: {"round": int(d.parent.name.removeprefix("round")), **score_model(d, images, args)}
              for d in model_dirs}

    results = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "normalization": "NFC; markup stripped; tatweel and bidi marks removed; "
                         "Arabic-Indic digits mapped to Western; thousands separators unified; whitespace collapsed",
        "failure_rule": "CER > 1.0, empty output, or error",
        "pricing": {"gpu_hourly_usd": args.gpu_hourly_usd,
                    "gemini_input_usd_per_m": args.gemini_input_usd_per_m,
                    "gemini_output_usd_per_m": args.gemini_output_usd_per_m},
        "test_set": {
            p.stem: {
                "file": p.name,
                "scenario": SCENARIOS.get(p.stem[:2], p.stem),
                "ground_truth": (p.parent / f"{p.stem}.gt.txt").read_text(encoding="utf-8"),
            }
            for p in images
        },
        "models": models,
    }
    args.results.parent.mkdir(parents=True, exist_ok=True)
    args.results.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"{'model':<8} {'rnd':>3} {'CER':>7} {'CER-nd':>7} {'WER':>7} {'p95':>7} {'fail':>6} {'loops':>5} "
          f"{'cut':>7} {'s/page':>7} {'VRAM':>6}")
    ranked = sorted(models.items(), key=lambda kv: kv[1]["summary"]["cer_median"])
    for name, m in ranked:
        s = m["summary"]
        fmt = lambda v, f="{:.3f}": "-" if v is None else f.format(v)  # noqa: E731
        print(f"{name:<8} {m['round']:>3} {fmt(s['cer_mean']):>7} {fmt(s['cer_no_diacritics_mean']):>7} "
              f"{fmt(s['wer_mean']):>7} {fmt(s['cer_p95']):>7} {fmt(s['failure_rate'], '{:.0%}'):>6} "
              f"{s['loops']:>5} {fmt(s['cer_mean_loop_cut']):>7} "
              f"{fmt(s['latency_median_s'], '{:.1f}'):>7} {fmt(s['peak_vram_gb'], '{:.1f}'):>6}")
    print(f"\nwrote {args.results}")


if __name__ == "__main__":
    main()
