import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"

if not ENV_PATH.exists():
    raise FileNotFoundError(f".env file not found at {ENV_PATH}")

load_dotenv(dotenv_path=ENV_PATH)

from backend.logger import get_logger
_logger = get_logger(__name__)


def _get_env(key: str, required: bool = True) -> str:
    value = os.getenv(key, "").strip()
    if required and not value:
        raise ValueError(f"Missing required env var: {key}")
    return value


GROQ_API_KEY: str = _get_env("GROQ_API_KEY")
ELEVENLABS_API_KEY: str = _get_env("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID: str = _get_env("ELEVENLABS_VOICE_ID")

# Optional seed — overridable at runtime via GET /admin/set-pod-url
RUNPOD_URL: str = _get_env("RUNPOD_URL", required=False)

for _k, _v in [
    ("GROQ_API_KEY", GROQ_API_KEY),
    ("ELEVENLABS_API_KEY", ELEVENLABS_API_KEY),
    ("ELEVENLABS_VOICE_ID", ELEVENLABS_VOICE_ID),
]:
    _logger.info(f"Config: {_k}=SET ({len(_v)} chars)")

if RUNPOD_URL:
    _logger.info(f"Config: RUNPOD_URL={RUNPOD_URL}")
