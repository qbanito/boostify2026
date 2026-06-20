"""
Deploy FHDR_Uncensored to HuggingFace Inference Endpoints.

Usage:
  python deploy-fhdr-endpoint.py          # Deploy new endpoint
  python deploy-fhdr-endpoint.py status   # Check status
  python deploy-fhdr-endpoint.py pause    # Pause (stop billing)
  python deploy-fhdr-endpoint.py resume   # Resume
  python deploy-fhdr-endpoint.py delete   # Delete endpoint

Requirements:
  pip install huggingface_hub

Pricing (~):
  - A10G (24GB VRAM): ~$1.30/hr  ← recommended for FLUX 12B
  - A100 (80GB VRAM): ~$4.00/hr  ← fastest, overkill
  - Scale-to-zero: only pay when active (cold start ~60-120s)
"""

import os
import sys
from huggingface_hub import (
    HfApi,
    create_inference_endpoint,
    get_inference_endpoint,
)

ENDPOINT_NAME = "boostify-fhdr-uncensored"
REPOSITORY = "kpsss34/FHDR_Uncensored"
NAMESPACE = os.environ.get("HF_NAMESPACE", "metafeed")  # Your HF username/org
HF_TOKEN = os.environ.get("HUGGINGFACE_TOKEN", "")

# GPU Config — A10G is the sweet spot for FLUX 12B models
VENDOR = "aws"
REGION = "us-east-1"
ACCELERATOR = "gpu"
INSTANCE_TYPE = "nvidia-a10g"
INSTANCE_SIZE = "x1"
MIN_REPLICA = 0  # Scale to zero when idle (saves money)
MAX_REPLICA = 1


def deploy():
    """Create and deploy a new HF Inference Endpoint."""
    print(f"🚀 Deploying {REPOSITORY} as '{ENDPOINT_NAME}'...")
    print(f"   GPU: {INSTANCE_TYPE} ({INSTANCE_SIZE})")
    print(f"   Region: {VENDOR}/{REGION}")
    print(f"   Scale-to-zero: {'Yes' if MIN_REPLICA == 0 else 'No'}")
    print()

    try:
        # Check if endpoint already exists
        try:
            existing = get_inference_endpoint(ENDPOINT_NAME, namespace=NAMESPACE, token=HF_TOKEN)
            print(f"⚠️  Endpoint '{ENDPOINT_NAME}' already exists (status: {existing.status})")
            print(f"   URL: {existing.url}")
            print(f"   Use 'python deploy-fhdr-endpoint.py status' to check it")
            return existing
        except Exception:
            pass  # Endpoint doesn't exist, continue with creation

        endpoint = create_inference_endpoint(
            name=ENDPOINT_NAME,
            repository=REPOSITORY,
            namespace=NAMESPACE,
            framework="pytorch",
            task="text-to-image",
            accelerator=ACCELERATOR,
            vendor=VENDOR,
            region=REGION,
            type="protected",  # Requires token to access
            instance_size=INSTANCE_SIZE,
            instance_type=INSTANCE_TYPE,
            min_replica=MIN_REPLICA,
            max_replica=MAX_REPLICA,
            token=HF_TOKEN,
        )

        print(f"✅ Endpoint created! Status: {endpoint.status}")
        print(f"   Name: {endpoint.name}")
        print()

        if endpoint.status != "running":
            print("⏳ Waiting for endpoint to be ready (this may take 5-15 min for first deploy)...")
            endpoint.wait(timeout=900)  # 15 min timeout

        print(f"🎉 Endpoint is RUNNING!")
        print(f"   URL: {endpoint.url}")
        print()
        print(f"📋 Add this to your .env file:")
        print(f"   HF_FHDR_ENDPOINT_URL={endpoint.url}")
        print()
        print(f"💡 To save money, the endpoint will scale to zero after inactivity.")
        print(f"   First request after idle will have a ~60-120s cold start.")

        return endpoint

    except Exception as e:
        print(f"❌ Deploy failed: {e}")
        sys.exit(1)


def status():
    """Check the status of the endpoint."""
    try:
        endpoint = get_inference_endpoint(ENDPOINT_NAME, namespace=NAMESPACE, token=HF_TOKEN)
        print(f"📊 Endpoint: {endpoint.name}")
        print(f"   Status:  {endpoint.status}")
        print(f"   URL:     {endpoint.url or 'N/A (not running)'}")
        print(f"   Model:   {endpoint.repository}")
        return endpoint
    except Exception as e:
        print(f"❌ Could not find endpoint '{ENDPOINT_NAME}': {e}")
        sys.exit(1)


def pause():
    """Pause the endpoint (stops billing)."""
    endpoint = get_inference_endpoint(ENDPOINT_NAME, namespace=NAMESPACE, token=HF_TOKEN)
    print(f"⏸️  Pausing endpoint '{ENDPOINT_NAME}' (status: {endpoint.status})...")
    endpoint.pause()
    print(f"✅ Endpoint paused. No more charges until resumed.")


def resume():
    """Resume a paused endpoint."""
    endpoint = get_inference_endpoint(ENDPOINT_NAME, namespace=NAMESPACE, token=HF_TOKEN)
    print(f"▶️  Resuming endpoint '{ENDPOINT_NAME}' (status: {endpoint.status})...")
    endpoint.resume()
    print(f"⏳ Endpoint resuming... waiting for it to be ready...")
    endpoint.wait(timeout=600)
    print(f"✅ Endpoint running! URL: {endpoint.url}")


def delete():
    """Delete the endpoint permanently."""
    confirm = input(f"⚠️  Are you sure you want to DELETE endpoint '{ENDPOINT_NAME}'? (yes/no): ")
    if confirm.lower() != "yes":
        print("Cancelled.")
        return
    endpoint = get_inference_endpoint(ENDPOINT_NAME, namespace=NAMESPACE, token=HF_TOKEN)
    endpoint.delete()
    print(f"🗑️  Endpoint '{ENDPOINT_NAME}' deleted.")


if __name__ == "__main__":
    os.environ["HUGGINGFACE_TOKEN"] = HF_TOKEN

    command = sys.argv[1] if len(sys.argv) > 1 else "deploy"
    commands = {
        "deploy": deploy,
        "status": status,
        "pause": pause,
        "resume": resume,
        "delete": delete,
    }

    if command not in commands:
        print(f"Unknown command: {command}")
        print(f"Available: {', '.join(commands.keys())}")
        sys.exit(1)

    commands[command]()
