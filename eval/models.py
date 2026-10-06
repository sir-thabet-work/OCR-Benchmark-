"""OCR model registry.

Each class loads and runs one model the way its model card documents it
(same prompt, same preprocessing). Decoding is fixed for every model:
greedy, same max_new_tokens. The only per-model generation setting kept from
the cards is repetition_penalty, where the card sets one.
"""
import io
import os

import torch
from PIL import Image, ImageEnhance

MAX_NEW_TOKENS = 2048


def pick_dtype():
    """bf16 on GPUs that support it natively (Ampere+), fp16 otherwise (T4)."""
    if torch.cuda.is_available() and torch.cuda.get_device_capability()[0] >= 8:
        return torch.bfloat16
    return torch.float16


def load_processor(repo, fallback=None, **kwargs):
    """Adapter repos may ship an incomplete processor; fall back to the base model's."""
    from transformers import AutoProcessor

    try:
        return AutoProcessor.from_pretrained(repo, **kwargs)
    except Exception:
        if fallback is None:
            raise
        return AutoProcessor.from_pretrained(fallback, **kwargs)


def generate(model, processor, inputs, max_new_tokens, repetition_penalty=1.0):
    inputs = inputs.to(model.device, dtype=model.dtype)
    with torch.inference_mode():
        out = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False,
            repetition_penalty=repetition_penalty,
        )
    new_tokens = out[:, inputs["input_ids"].shape[1]:]
    return processor.batch_decode(
        new_tokens, skip_special_tokens=True, clean_up_tokenization_spaces=False
    )[0].strip()


def chat(image, prompt, system=None):
    messages = [{"role": "user", "content": [
        {"type": "image", "image": image},
        {"type": "text", "text": prompt},
    ]}]
    if system:
        messages.insert(0, {"role": "system", "content": [{"type": "text", "text": system}]})
    return messages


class OCRModel:
    id = ""
    repo = ""
    prompt = ""
    is_api = False

    def __init__(self, max_new_tokens=MAX_NEW_TOKENS):
        self.max_new_tokens = max_new_tokens
        self.model = None
        self.processor = None
        self.precision = None

    def load(self):
        raise NotImplementedError

    def predict(self, image):
        """Return (text_to_score, extra_dict). extra may hold 'raw' model output."""
        raise NotImplementedError

    def unload(self):
        self.model = None
        self.processor = None
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


class Qari(OCRModel):
    """NAMAA-Space Qari 0.4.0: LoRA adapter on Qwen3-VL-4B-Instruct."""
    id = "qari"
    repo = "NAMAA-Space/Qari-OCR-0.4.0-VL-4B-Instruct"
    base = "unsloth/Qwen3-VL-4B-Instruct"  # base_model_name_or_path in adapter_config.json
    prompt = "Free OCR."

    def load(self):
        from peft import PeftModel
        from transformers import AutoModelForImageTextToText

        dtype = pick_dtype()
        base = AutoModelForImageTextToText.from_pretrained(self.base, dtype=dtype, device_map="cuda")
        self.model = PeftModel.from_pretrained(base, self.repo).merge_and_unload().eval()
        self.processor = load_processor(self.repo, self.base)
        self.precision = str(dtype)

    def predict(self, image):
        inputs = self.processor.apply_chat_template(
            chat(image, self.prompt), tokenize=True, add_generation_prompt=True,
            return_dict=True, return_tensors="pt",
        )
        return generate(self.model, self.processor, inputs, self.max_new_tokens), {}


def clean_repeated_substrings(text):
    """From Misraj's Nakba pipeline: trims a substring repeated 10+ times at the end."""
    n = len(text)
    if n < 200:
        return text
    for length in range(2, n // 10 + 1):
        candidate = text[-length:]
        count = 0
        i = n - length
        while i >= 0 and text[i:i + length] == candidate:
            count += 1
            i -= length
        if count >= 10:
            return text[:n - length * (count - 1)]
    return text


class Baseer(OCRModel):
    """Misraj Baseer-Nakba: Baseer 3B (Qwen2.5-VL) adapted to historical handwriting.

    The structure-aware Misraj/Baseer-Qwen2.5-VL-3B-Instruct is no longer public;
    this is the only open Baseer checkpoint. Settings follow
    github.com/misraj-ai/Nakba-pipeline (prompt, pixel limits, repetition
    penalty 1.1, loop cleanup).
    """
    id = "baseer"
    repo = "Misraj/Baseer__Nakba"
    prompt = "Extract the text from the above document."
    system = "You are a helpful assistant."

    def load(self):
        from transformers import Qwen2_5_VLForConditionalGeneration

        dtype = pick_dtype()
        self.model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
            self.repo, dtype=dtype, device_map="cuda"
        ).eval()
        self.processor = load_processor(self.repo, min_pixels=28 * 28, max_pixels=1280 * 28 * 28)
        self.precision = str(dtype)

    def predict(self, image):
        inputs = self.processor.apply_chat_template(
            chat(image, self.prompt, self.system), tokenize=True, add_generation_prompt=True,
            return_dict=True, return_tensors="pt",
        )
        raw = generate(self.model, self.processor, inputs, self.max_new_tokens, repetition_penalty=1.1)
        return clean_repeated_substrings(raw), {"raw": raw}


def flatten_json(obj):
    if isinstance(obj, dict):
        return [s for v in obj.values() for s in flatten_json(v)]
    if isinstance(obj, list):
        return [s for v in obj for s in flatten_json(v)]
    if obj is None or obj == "":
        return []
    return [str(obj)]


class Legal(OCRModel):
    """bakrianoo arabic-legal-documents-ocr-1.0: fine-tuned Gemma-3-4B-IT.

    The card makes preprocessing mandatory and the model answers in JSON.
    For CER/WER all JSON string values are joined into plain text; the raw
    JSON is saved next to it.
    """
    id = "legal"
    repo = "bakrianoo/arabic-legal-documents-ocr-1.0"
    prompt = "Extract details to JSON."

    @staticmethod
    def preprocess(image, max_width=1024):
        gray = image.convert("L")
        if gray.width > max_width:
            ratio = max_width / float(gray.width)
            gray = gray.resize((max_width, int(gray.height * ratio)), Image.LANCZOS)
        return ImageEnhance.Contrast(gray).enhance(1.5).convert("RGB")

    def load(self):
        from transformers import BitsAndBytesConfig, Gemma3ForConditionalGeneration

        if pick_dtype() == torch.bfloat16:
            kwargs = {"dtype": torch.bfloat16}
            self.precision = "torch.bfloat16"
        else:
            # Gemma 3 overflows in fp16. Without bf16 (T4), load 4-bit weights with fp32 compute.
            kwargs = {
                "dtype": torch.float32,
                "quantization_config": BitsAndBytesConfig(
                    load_in_4bit=True, bnb_4bit_compute_dtype=torch.float32
                ),
            }
            self.precision = "nf4 weights, fp32 compute (no bf16 on this GPU)"
        self.model = Gemma3ForConditionalGeneration.from_pretrained(
            self.repo, device_map="cuda", **kwargs
        ).eval()
        self.processor = load_processor(self.repo)

    def predict(self, image):
        import json_repair

        inputs = self.processor.apply_chat_template(
            chat(self.preprocess(image), self.prompt), tokenize=True, add_generation_prompt=True,
            return_dict=True, return_tensors="pt",
        )
        raw = generate(self.model, self.processor, inputs, self.max_new_tokens)
        try:
            parsed = json_repair.loads(raw)
        except Exception:
            parsed = None
        parts = flatten_json(parsed) if isinstance(parsed, (dict, list)) else []
        text = "\n".join(parts) if parts else raw
        return text, {"raw": raw}


class Katib(OCRModel):
    """oddadmix Katib 0.8B: LoRA adapter on Qwen3.5-0.8B."""
    id = "katib"
    repo = "oddadmix/Katib-Qwen3.5-0.8B-0.1"
    base = "unsloth/Qwen3.5-0.8B"  # base_model_name_or_path in adapter_config.json
    prompt = "Free OCR"

    def load(self):
        from peft import PeftModel
        from transformers import AutoModelForImageTextToText

        dtype = pick_dtype()
        base = AutoModelForImageTextToText.from_pretrained(self.base, dtype=dtype, device_map="cuda")
        self.model = PeftModel.from_pretrained(base, self.repo).merge_and_unload().eval()
        self.processor = load_processor(self.repo, self.base)
        self.precision = str(dtype)

    def predict(self, image):
        text = self.processor.apply_chat_template(
            chat(image, self.prompt), tokenize=False, add_generation_prompt=True
        )
        inputs = self.processor(text=[text], images=[image], return_tensors="pt")
        return generate(self.model, self.processor, inputs, self.max_new_tokens), {}


class Waqf(OCRModel):
    """Waqf AI handwriting model: fine-tuned PaddleOCR-VL-1.6 (custom code in repo).

    The card's snippet points at Waqf-AI/written_ocr_paddle1.6, which is not
    public; the weights are in this repo. Trained on text lines (KHATT).
    """
    id = "waqf"
    repo = "Waqf-AI/waqf-ocr-hand-written-v1"
    prompt = "OCR:"

    def load(self):
        from transformers import AutoModelForImageTextToText

        dtype = pick_dtype()
        self.model = AutoModelForImageTextToText.from_pretrained(
            self.repo, trust_remote_code=True, dtype=dtype
        ).to("cuda").eval()
        self.processor = load_processor(self.repo, trust_remote_code=True)
        self.precision = str(dtype)

    def predict(self, image):
        inputs = self.processor.apply_chat_template(
            chat(image, self.prompt), tokenize=True, add_generation_prompt=True,
            return_dict=True, return_tensors="pt",
        )
        return generate(self.model, self.processor, inputs, self.max_new_tokens), {}


class Sherif(OCRModel):
    """sherif1313 handwriting model: Qwen2.5-VL-3B, pre-quantized 4-bit (bitsandbytes nf4).

    Card prompt and repetition_penalty=1.1 are kept. The card's
    min_new_tokens=50 is dropped: it forces text on single-word images.
    """
    id = "sherif"
    repo = "sherif1313/Arabic-handwritten-OCR-4bit-Qwen2.5-VL-3B-v2"
    prompt = (
        "ارجو استخراج النص العربي كاملاً من هذه الصورة من البداية الى النهاية "
        "بدون اي اختصار ودون ذيادة او حذف. اقرأ كل المحتوى النصي الموجود في الصورة:"
    )

    def load(self):
        from transformers import Qwen2_5_VLForConditionalGeneration

        dtype = pick_dtype()
        self.model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
            self.repo, dtype=dtype, device_map="cuda"
        ).eval()
        self.processor = load_processor(self.repo)
        self.precision = f"nf4 weights, {dtype} compute"

    def predict(self, image):
        text = self.processor.apply_chat_template(
            chat(image, self.prompt), tokenize=False, add_generation_prompt=True
        )
        inputs = self.processor(text=[text], images=[image], padding=True, return_tensors="pt")
        return generate(self.model, self.processor, inputs, self.max_new_tokens, repetition_penalty=1.1), {}


class Gemini(OCRModel):
    """Frontier upper bound via the Gemini API.

    Needs GEMINI_API_KEY and GEMINI_MODEL (set it to the newest Gemini model).
    """
    id = "gemini"
    repo = "Google Gemini API"
    prompt = (
        "Extract all text from this image exactly as written. Keep the original language, "
        "spelling, diacritics (tashkeel), numbers and reading order. Write tables as Markdown "
        "tables. Output only the extracted text, with no explanations."
    )
    is_api = True

    def load(self):
        from google import genai

        self.model_name = os.environ.get("GEMINI_MODEL")
        if not self.model_name:
            raise RuntimeError("Set GEMINI_MODEL to the Gemini model id to evaluate.")
        self.repo = self.model_name
        self.client = genai.Client()
        self.precision = "api"

    def predict(self, image):
        from google.genai import types

        buf = io.BytesIO()
        image.save(buf, format="PNG")
        resp = self.client.models.generate_content(
            model=self.model_name,
            contents=[types.Part.from_bytes(data=buf.getvalue(), mime_type="image/png"), self.prompt],
            config=types.GenerateContentConfig(temperature=0),
        )
        usage = resp.usage_metadata
        extra = {
            "input_tokens": getattr(usage, "prompt_token_count", None) or 0,
            # thinking tokens are billed as output
            "output_tokens": (getattr(usage, "candidates_token_count", None) or 0)
            + (getattr(usage, "thoughts_token_count", None) or 0),
        }
        return (resp.text or "").strip(), extra


MODELS = {m.id: m for m in [Qari, Baseer, Legal, Katib, Waqf, Sherif, Gemini]}
