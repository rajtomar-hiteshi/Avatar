import os
from pathlib import Path

_STATE_FILE = Path(__file__).parent / ".runpod_url"

def _load_runpod_url() -> str:
    """Load from state file first, then env var, then empty."""
    if _STATE_FILE.exists():
        return _STATE_FILE.read_text().strip().rstrip("/")
    return os.getenv("RUNPOD_URL", "").strip().rstrip("/")

def _save_runpod_url(url: str):
    _STATE_FILE.write_text(url)

runpod_url: str = _load_runpod_url()
