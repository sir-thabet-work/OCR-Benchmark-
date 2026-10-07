"""Run OCR models over the test images and save their outputs.

Usage:
    python eval/run_models.py qari                # one model
    python eval/run_models.py qari katib waqf     # several, one after another
    python eval/run_models.py all
    python eval/run_models.py round2              # the six round-2 models
    python eval/run_models.py gemini --resume     # only rerun images that failed or are missing

Writes, per model:
    outputs/round<N>/<model>/<image>.txt       text that gets scored
    outputs/round<N>/<model>/<image>.raw.txt   raw model output, when it differs (JSON, loop cleanup, thinking)
    outputs/round<N>/<model>/_run.json         prompt, versions, GPU, latency and VRAM per image, errors
"""
import argparse
import json
import platform
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

try:
    import torch
except ImportError:  # API-only runs (Gemini) work without torch
    torch = None

sys.path.insert(0, str(Path(__file__).parent))
from models import MAX_NEW_TOKENS, MODELS, ROUND_1, ROUND_2  # noqa: E402

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def environment():
    env = {"python": platform.python_version(), "torch": torch.__version__ if torch else None}
    for pkg in ("transformers", "peft", "bitsandbytes", "google.genai"):
        try:
            env[pkg] = __import__(pkg, fromlist=["__version__"]).__version__
        except Exception:
            env[pkg] = None
    env["gpu"] = torch.cuda.get_device_name(0) if torch and torch.cuda.is_available() else None
    return env


def model_revision(repo):
    try:
        from huggingface_hub import HfApi

        return HfApi().model_info(repo).sha
    except Exception:
        return None


def run_model(model_id, images, out_root, max_new_tokens, resume=False):
    model = MODELS[model_id](max_new_tokens=max_new_tokens)
    out_dir = out_root / f"round{model.round}" / model_id
    out_dir.mkdir(parents=True, exist_ok=True)
    run_file = out_dir / "_run.json"
    now = datetime.now(timezone.utc).isoformat()
    run = {
        "model": model_id,
        "round": model.round,
        "started_at": now,
        "prompt": model.prompt,
        "max_new_tokens": model.max_new_tokens,  # a card may require more than the default
        "environment": environment(),
        "images": {},
    }
    if resume and run_file.exists():
        # keep images that already succeeded; rerun only the failed or missing ones
        previous = json.loads(run_file.read_text(encoding="utf-8"))
        run["started_at"] = previous.get("started_at", now)
        run["resumed_at"] = previous.get("resumed_at", []) + [now]
        run["images"] = {
            stem: meta for stem, meta in previous.get("images", {}).items()
            if not meta.get("error") and (out_dir / f"{stem}.txt").exists()
        }
        images = [p for p in images if p.stem not in run["images"]]
        print(f"=== {model_id}: resuming, {len(run['images'])} done, {len(images)} to run", flush=True)
    save = lambda: run_file.write_text(json.dumps(run, ensure_ascii=False, indent=2), encoding="utf-8")  # noqa: E731
    cuda = torch is not None and torch.cuda.is_available() and not model.is_api

    print(f"\n=== {model_id}: loading", flush=True)
    t0 = time.perf_counter()
    try:
        model.load()
    except Exception as e:
        run["load_error"] = f"{type(e).__name__}: {e}"
        traceback.print_exc()
        save()
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
        save()  # after every image, so an interrupted run can be resumed

    run["images"] = dict(sorted(run["images"].items()))
    run["finished_at"] = datetime.now(timezone.utc).isoformat()
    save()
    model.unload()
    print(f"=== {model_id}: done -> {out_dir}", flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("models", nargs="+", help=f"model ids ({', '.join(MODELS)}), 'round1', 'round2' or 'all'")
    ap.add_argument("--images", default="test_images", type=Path)
    ap.add_argument("--out", default="outputs", type=Path)
    ap.add_argument("--max-new-tokens", default=MAX_NEW_TOKENS, type=int)
    ap.add_argument("--resume", action="store_true",
                    help="skip images that already succeeded in outputs/round<N>/<model>/_run.json")
    args = ap.parse_args()

    groups = {"all": list(MODELS), "round1": [m.id for m in ROUND_1], "round2": [m.id for m in ROUND_2]}
    ids = [i for name in args.models for i in groups.get(name, [name])]
    unknown = [m for m in ids if m not in MODELS]
    if unknown:
        ap.error(f"unknown model(s): {', '.join(unknown)}")

    images = sorted(p for p in args.images.iterdir() if p.suffix.lower() in IMAGE_EXTS)
    print(f"{len(images)} images from {args.images}")
    for model_id in ids:
        run_model(model_id, images, args.out, args.max_new_tokens, args.resume)


if __name__ == "__main__":
    main()
