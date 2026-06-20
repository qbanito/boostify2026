"""Quick test: FHDR_Uncensored via local FluxPipeline (RTX 3080 16GB)"""
import os
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import torch
import gc
from diffusers import FluxPipeline
from transformers import T5TokenizerFast
import time

HF_TOKEN = os.environ.get("HUGGINGFACE_TOKEN", "")

print("Loading FHDR_Uncensored model with memory optimizations...")

# Load T5 tokenizer from the base T5 model (same tokenizer used by FLUX)
print("Loading T5 tokenizer from google-t5/t5-11b...")
tokenizer_2 = T5TokenizerFast.from_pretrained("google-t5/t5-11b")

print("Loading FluxPipeline...")
pipe = FluxPipeline.from_pretrained(
    "kpsss34/FHDR_Uncensored",
    tokenizer_2=tokenizer_2,
    torch_dtype=torch.bfloat16,
    token=HF_TOKEN,
)
pipe.enable_sequential_cpu_offload()
gc.collect()
torch.cuda.empty_cache()
print("Model loaded!")

prompt = "A futuristic cyberpunk city at night, neon lights reflecting on wet streets, towering skyscrapers, flying cars, cinematic lighting, ultra detailed, 8k"
print(f"Generating: {prompt}")

image = pipe(
    prompt,
    height=512,
    width=512,
    guidance_scale=4.0,
    num_inference_steps=20,
    max_sequence_length=256,
    generator=torch.Generator("cpu").manual_seed(42),
).images[0]

out_dir = os.path.join("attached_assets", "generations")
os.makedirs(out_dir, exist_ok=True)
path = os.path.join(out_dir, f"fhdr_test_{int(time.time())}.png")
image.save(path)
print(f"Image saved: {path}")
