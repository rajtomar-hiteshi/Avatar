import os

# Seeded from RUNPOD_URL env var; overridable at runtime via GET /admin/set-pod-url
runpod_url: str = os.getenv("RUNPOD_URL", "").strip().rstrip("/")
