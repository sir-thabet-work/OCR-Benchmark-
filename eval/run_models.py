"""Run OCR models over the test images and save their outputs.

Usage:
    python eval/run_models.py qari                # one model
    python eval/run_models.py qari katib waqf     # several, one after another
    python eval/run_models.py all

Writes, per model:
    outputs/<model>/<image>.txt       text that gets scored
    outputs/<model>/<image>.raw.txt   raw model output, when it differs (JSON, loop cleanup)
    outputs/<model>/_run.json         prompt, versions, GPU, latency and VRAM per image, errors
"""
import argparse
import json
import platform
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

import torch
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from models import MAX_NEW_TOKENS, MODELS  # noqa: E402

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def environment():
    env = {"python": platform.python_version(), "torch": torch.__version__}
    for pkg in ("transformers", "peft", "bitsandbytes", "google.genai"):
        try:
            env[pkg] = __import__(pkg, fromlist=["__version__"]).__version__
        except Exception:
            env[pkg] = None
    env["gpu"] = torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
    return env


def model_revision(repo):
    try:
        from huggingface_hub import HfApi

        return HfApi().model_info(repo).sha
    except Exception:
        return None


def run_model(model_id, images, out_root, max_new_tokens):
    model = MODELS[model_id](max_new_tokens=max_new_tokens)
    out_dir = out_root / model_id
    out_dir.mkdir(parents=True, exist_ok=True)
    run = {
        "model": model_id,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "prompt": model.prompt,
        "max_new_tokens": max_new_tokens,
        "environment": environment(),
        "images": {},
    }
    cuda = torch.cuda.is_available() and not model.is_api

    print(f"\n=== {model_id}: loading", flush=True)
    t0 = time.perf_counter()
    try:
        model.load()
    except Exception as e:
        run["load_error"] = f"{type(e).__name__}: {e}"
        traceback.print_exc()
        (out_dir / "_run.json").write_text(json.dumps(run, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"=== {model_id}: FAILED TO LOAD, skipped", flush=True)
        return
    run.update(repo=model.repo, revision=None if model.is_api else model_revision(model.repo),
               precision=model.precision, load_seconds=round(time.perf_counter() - t0, 1))

    for path in images:
        image = Image.open(path).convert("RGB")
        if cuda:
            torch.cuda.synchronize()
            torch.cuda.reset_peak_memory_stats()
        t = time.perf_counter()
        try:
            text, extra = model.predict(image)
            error = None
        except Exception as e:
            text, extra, error = "", {}, f"{type(e).__name__}: {e}"
            traceback.print_exc()
            if cuda:
                torch.cuda.empty_cache()
        if cuda:
            torch.cuda.synchronize()
        latency = time.perf_counter() - t

        (out_dir / f"{path.stem}.txt").write_text(text, encoding="utf-8")
        raw = extra.pop("raw", None)
        if raw is not None and raw != text:
            (out_dir / f"{path.stem}.raw.txt").write_text(raw, encoding="utf-8")
        run["images"][path.stem] = {
            "latency_s": round(latency, 3),
            "peak_vram_gb": round(torch.cuda.max_memory_allocated() / 1e9, 2) if cuda else None,
            "output_chars": len(text),
            "error": error,
            **extra,
        }
        status = f"ERROR {error}" if error else f"{len(text)} chars"
        print(f"  {path.name:<36} {latency:6.1f}s  {status}", flush=True)

    run["finished_at"] = datetime.now(timezone.utc).isoformat()
    (out_dir / "_run.json").write_text(json.dumps(run, ensure_ascii=False, indent=2), encoding="utf-8")
    model.unload()
    print(f"=== {model_id}: done -> {out_dir}", flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("models", nargs="+", help=f"model ids ({', '.join(MODELS)}) or 'all'")
    ap.add_argument("--images", default="test_images", type=Path)
    ap.add_argument("--out", default="outputs", type=Path)
    ap.add_argument("--max-new-tokens", default=MAX_NEW_TOKENS, type=int)
    args = ap.parse_args()

    ids = list(MODELS) if args.models == ["all"] else args.models
    unknown = [m for m in ids if m not in MODELS]
    if unknown:
        ap.error(f"unknown model(s): {', '.join(unknown)}")

    images = sorted(p for p in args.images.iterdir() if p.suffix.lower() in IMAGE_EXTS)
    print(f"{len(images)} images from {args.images}")
    for model_id in ids:
        run_model(model_id, images, args.out, args.max_new_tokens)


if __name__ == "__main__":
    main()
