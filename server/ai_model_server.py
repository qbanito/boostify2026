from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import json
import os
import subprocess
import shlex
import sys
import time
import logging
import base64

logger = logging.getLogger("boostify-ai")

app = FastAPI(title="Boostify AI Model Proxy")

# Serve generated files statically
_gen_dir = os.path.join(os.getcwd(), "attached_assets", "generations")
os.makedirs(_gen_dir, exist_ok=True)
app.mount("/attached_assets/generations", StaticFiles(directory=_gen_dir), name="generations")

class GenerateRequest(BaseModel):
    task: str
    prompt: str
    duration: Optional[int] = 5
    resolution: Optional[str] = "512x512"

class FHDRRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = None
    num_inference_steps: Optional[int] = 30
    guidance_scale: Optional[float] = 7.5
    width: Optional[int] = 1024
    height: Optional[int] = 1024

# ─── HuggingFace Inference API (Cloud — no GPU needed) ───
HF_INFERENCE_URL = "https://router.huggingface.co/models/kpsss34/FHDR_Uncensored"

def call_hf_inference_api(prompt: str, negative_prompt: str = None, steps: int = 30, guidance: float = 7.5) -> bytes:
    """Call HuggingFace Inference API to generate image remotely (no local GPU)."""
    import requests

    hf_token = os.environ.get("HUGGINGFACE_TOKEN")
    if not hf_token:
        raise RuntimeError("HUGGINGFACE_TOKEN env var not set")

    headers = {"Authorization": f"Bearer {hf_token}"}
    payload = {
        "inputs": prompt,
        "parameters": {
            "num_inference_steps": min(steps, 100),
            "guidance_scale": max(0.0, min(guidance, 30.0)),
        },
    }
    if negative_prompt:
        payload["parameters"]["negative_prompt"] = negative_prompt

    logger.info(f"[FHDR-Cloud] Calling HF Inference API for: {prompt[:80]}...")
    response = requests.post(HF_INFERENCE_URL, headers=headers, json=payload, timeout=300)

    if response.status_code == 503:
        # Model is loading — wait and retry once
        wait_time = response.json().get("estimated_time", 60)
        logger.info(f"[FHDR-Cloud] Model loading, estimated wait: {wait_time}s")
        import time as _time
        _time.sleep(min(wait_time, 120))
        response = requests.post(HF_INFERENCE_URL, headers=headers, json=payload, timeout=300)

    if response.status_code != 200:
        detail = response.text[:500]
        raise RuntimeError(f"HF Inference API error ({response.status_code}): {detail}")

    content_type = response.headers.get("content-type", "")
    if "image" not in content_type and "octet-stream" not in content_type:
        raise RuntimeError(f"Unexpected response type: {content_type} — {response.text[:300]}")

    return response.content

# ─── FHDR Uncensored Model (lazy-loaded for LOCAL GPU) ───
_fhdr_pipeline = None

def get_fhdr_pipeline():
    """Lazy-load the FHDR_Uncensored FluxPipeline on first use (requires CUDA GPU)."""
    global _fhdr_pipeline
    if _fhdr_pipeline is not None:
        return _fhdr_pipeline

    try:
        import torch
        from diffusers import FluxPipeline
        from transformers import T5TokenizerFast

        hf_token = os.environ.get("HUGGINGFACE_TOKEN")
        dtype = torch.bfloat16

        # Pre-load T5 tokenizer from canonical source to avoid sentencepiece/transformers compat issue
        logger.info("[FHDR] Loading T5 tokenizer from google-t5/t5-11b...")
        tokenizer_2 = T5TokenizerFast.from_pretrained("google-t5/t5-11b")

        logger.info("[FHDR] Loading kpsss34/FHDR_Uncensored with FluxPipeline + CPU offload...")
        _fhdr_pipeline = FluxPipeline.from_pretrained(
            "kpsss34/FHDR_Uncensored",
            tokenizer_2=tokenizer_2,
            torch_dtype=dtype,
            token=hf_token,
        )
        _fhdr_pipeline.enable_sequential_cpu_offload()  # fits in 16GB VRAM

        logger.info("[FHDR] Model loaded successfully.")
        return _fhdr_pipeline
    except Exception as e:
        logger.error(f"[FHDR] Failed to load model: {e}")
        _fhdr_pipeline = None
        raise RuntimeError(f"Cannot load FHDR_Uncensored model: {e}")

@app.get("/health")
def health():
    fhdr_local = "loaded" if _fhdr_pipeline is not None else "not_loaded"
    hf_token_set = bool(os.environ.get("HUGGINGFACE_TOKEN"))
    return {
        "status": "ok",
        "message": "AI model server running",
        "fhdr_model": {"local": fhdr_local, "cloud_available": hf_token_set},
    }

# ─── FHDR Uncensored Image Generation (Cloud-first, Local fallback) ───
@app.post("/generate-fhdr")
def generate_fhdr(req: FHDRRequest):
    """Generate an uncensored image using FHDR_Uncensored.
    Strategy: Try HuggingFace Inference API (cloud) first, fall back to local GPU."""

    output_dir = os.path.join(os.getcwd(), "attached_assets", "generations")
    os.makedirs(output_dir, exist_ok=True)
    filename = f"fhdr_{int(time.time())}_{os.getpid()}.png"
    image_path = os.path.join(output_dir, filename)
    rel_url = f"/attached_assets/generations/{filename}"

    # ── Strategy 1: HuggingFace Inference API (Cloud — no local GPU needed) ──
    try:
        image_bytes = call_hf_inference_api(
            prompt=req.prompt,
            negative_prompt=req.negative_prompt,
            steps=req.num_inference_steps or 30,
            guidance=req.guidance_scale or 7.5,
        )
        with open(image_path, "wb") as f:
            f.write(image_bytes)
        logger.info(f"[FHDR-Cloud] Image saved: {filename}")
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        return {
            "task": "image",
            "status": "ok",
            "model": "FHDR_Uncensored",
            "backend": "huggingface-inference-api",
            "resultUrl": rel_url,
            "imageBase64": image_b64,
            "images": [{"url": rel_url}],
            "prompt": req.prompt,
        }
    except Exception as cloud_err:
        logger.warn(f"[FHDR-Cloud] Cloud generation failed: {cloud_err}. Trying local GPU...")

    # ── Strategy 2: Local GPU (requires CUDA + 12-16GB VRAM) ──
    try:
        pipe = get_fhdr_pipeline()
    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Both cloud and local FHDR generation failed. Cloud: {cloud_err}. Local: {e}",
        )

    try:
        import torch as _torch
        gen_kwargs = {
            "height": min(req.height or 1024, 1024),
            "width": min(req.width or 1024, 1024),
            "num_inference_steps": min(req.num_inference_steps or 20, 50),
            "guidance_scale": max(0.0, min(req.guidance_scale or 4.0, 20.0)),
            "max_sequence_length": 256,
            "generator": _torch.Generator("cpu").manual_seed(int(time.time()) % 2**32),
        }

        result = pipe(req.prompt, **gen_kwargs)
        image = result.images[0]
        image.save(image_path, format="PNG")

        # Read back as base64 for Node.js consumer
        with open(image_path, "rb") as f:
            image_b64 = base64.b64encode(f.read()).decode("utf-8")

        return {
            "task": "image",
            "status": "ok",
            "model": "FHDR_Uncensored",
            "backend": "local-gpu",
            "resultUrl": rel_url,
            "imageBase64": image_b64,
            "images": [{"url": rel_url}],
            "prompt": req.prompt,
        }
    except Exception as e:
        logger.error(f"[FHDR] Generation error: {e}")
        raise HTTPException(status_code=500, detail=f"FHDR generation failed: {e}")


WAN2_ALLOWED_SIZES = [
    "720*1280",
    "1280*720",
    "480*832",
    "832*480",
    "704*1280",
    "1280*704",
    "1024*704",
    "704*1024",
]


def run_wan2_text2video(prompt: str, output_path: str, size: str = "1280*704"):
    # Validate and sanitize size
    if size not in WAN2_ALLOWED_SIZES:
        raise RuntimeError(f"Invalid Wan2.2 size: {size}. Allowed: {WAN2_ALLOWED_SIZES}")

    base_dir = os.path.join(os.getcwd(), "open source", "Wan2.2-main", "Wan2.2-main")
    if not os.path.exists(base_dir):
        raise RuntimeError(f"Wan2.2 repo not found at {base_dir}")

    ckpt_dir = os.path.join(base_dir, "Wan2.2-TI2V-5B")
    if not os.path.exists(ckpt_dir):
        raise RuntimeError(f"TI2V checkpoint directory not found: {ckpt_dir}")

    python_executable = sys.executable if hasattr(sys, "executable") and sys.executable else "python"
    cmd = [
        python_executable,
        "generate.py",
        "--task", "ti2v-5B",
        "--size", size,
        "--ckpt_dir", ckpt_dir,
        "--offload_model", "True",
        "--convert_model_dtype",
        "--t5_cpu",
        "--save_file", output_path,
        "--prompt", prompt,
    ]

    env = os.environ.copy()
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"

    process = subprocess.run(cmd, cwd=base_dir, env=env, capture_output=True, text=True, timeout=3600)
    if process.returncode != 0:
        raise RuntimeError(
            "Wan2.2 generation failed: {}\ncmd: {}\nstdout: {}\nstderr: {}".format(
                process.returncode,
                " ".join(shlex.quote(p) for p in cmd),
                process.stdout,
                process.stderr,
            )
        )
    if not os.path.exists(output_path):
        raise RuntimeError(f"Wan2.2 output file not generated: {output_path}")

    return output_path


@app.post("/generate")
def generate(req: GenerateRequest):
    if req.task not in ["image", "video", "music"]:
        raise HTTPException(status_code=400, detail="task must be 'image', 'video', or 'music'")

    output_dir = os.path.join(os.getcwd(), "attached_assets", "generations")
    os.makedirs(output_dir, exist_ok=True)

    if req.task == "image":
        image_path = os.path.join(output_dir, f"generated_image_{int(time.time())}.png")
        with open(image_path, "wb") as f:
            f.write(b"\x89PNG\r\n\x1a\n")
        return {
            "task": "image",
            "status": "ok",
            "resultUrl": f"/attached_assets/generations/{os.path.basename(image_path)}",
            "images": [{"url": f"/attached_assets/generations/{os.path.basename(image_path)}"}],
            "prompt": req.prompt,
        }

    if req.task == "video":
        safe_prompt = req.prompt or "Boostify AI sample video"
        size = "1280*704"
        if req.resolution:
            res = req.resolution.strip().lower().replace(" ", "")
            if "x" in res:
                w, h = res.split("x", 1)
                candidate = f"{w}*{h}"
                if candidate in WAN2_ALLOWED_SIZES:
                    size = candidate
        video_path = os.path.join(output_dir, f"wan2_video_{int(time.time())}.mp4")
        try:
            generated_file = run_wan2_text2video(safe_prompt, video_path, size=size)
            rel_path = f"/attached_assets/generations/{os.path.basename(generated_file)}"
            return {
                "task": "video",
                "status": "ok",
                "resultUrl": rel_path,
                "video": {"url": rel_path},
                "prompt": req.prompt,
                "size": size,
                "model": "Wan2.2-TI2V-5B",
            }
        except Exception as e:
            fallback_path = os.path.join(output_dir, f"generated_video_stub_{int(time.time())}.mp4")
            with open(fallback_path, "wb") as f:
                f.write(b"\x00\x00\x00\x18ftypmp42")
            rel_fallback = f"/attached_assets/generations/{os.path.basename(fallback_path)}"
            return {
                "task": "video",
                "status": "fallback",
                "error": str(e),
                "resultUrl": rel_fallback,
                "video": {"url": rel_fallback},
                "prompt": req.prompt,
                "size": size,
                "model": "Wan2.2-TI2V-5B",
            }

    # Basic music stub
    music_path = os.path.join(output_dir, f"generated_music_{int(time.time())}.mp3")
    with open(music_path, "wb") as f:
        f.write(b"RIFF....WAVE")
    return {
        "task": "music",
        "status": "ok",
        "resultUrl": f"/attached_assets/generations/{os.path.basename(music_path)}",
        "prompt": req.prompt,
    }


@app.get("/status")
def status():
    import torch
    fhdr_loaded = _fhdr_pipeline is not None
    cuda_available = torch.cuda.is_available() if "torch" in sys.modules else False
    return {
        "status": "ok",
        "message": "local model server is ready",
        "models": {
            "wan2": {"name": "Wan2.2-TI2V-5B", "size_support": WAN2_ALLOWED_SIZES},
            "fhdr": {"name": "FHDR_Uncensored", "loaded": fhdr_loaded, "cuda": cuda_available},
        },
    }
