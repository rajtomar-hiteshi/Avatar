import os
from pathlib import Path
from dotenv import load_dotenv

# 🔥 --- LOAD ENV FIRST (CRITICAL) ---
BASE_DIR = Path(__file__).resolve().parents[1]  # project root (AI/)
ENV_PATH = BASE_DIR / ".env"

if not ENV_PATH.exists():
    raise FileNotFoundError(f".env file not found at {ENV_PATH}")

load_dotenv(dotenv_path=ENV_PATH)

# 🔍 Debug (optional, remove later)
print(f"[CONFIG] .env loaded from: {ENV_PATH}")

# --- Import logger AFTER env is loaded ---
from backend.logger import get_logger
_logger = get_logger(__name__)

# --- Helper function ---
def _get_env(key: str, required: bool = True) -> str:
    value = os.getenv(key, "").strip()
    if required and not value:
        raise ValueError(f"Missing required environment variable: {key}")
    return value

# --- REQUIRED KEYS ---
GROQ_API_KEY: str = _get_env("GROQ_API_KEY")
ELEVENLABS_API_KEY: str = _get_env("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID: str = _get_env("ELEVENLABS_VOICE_ID")

for _key_name, _value in [
    ("GROQ_API_KEY", GROQ_API_KEY),
    ("ELEVENLABS_API_KEY", ELEVENLABS_API_KEY),
    ("ELEVENLABS_VOICE_ID", ELEVENLABS_VOICE_ID),
]:
    _logger.info(f"Config: {_key_name}=SET ({len(_value)} chars)")

# --- LIVEKIT (NOW REQUIRED FOR YOUR SYSTEM) ---
LIVEKIT_URL: str = _get_env("LIVEKIT_URL")
LIVEKIT_API_KEY: str = _get_env("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET: str = _get_env("LIVEKIT_API_SECRET")

for _key_name, _value in [
    ("LIVEKIT_URL", LIVEKIT_URL),
    ("LIVEKIT_API_KEY", LIVEKIT_API_KEY),
    ("LIVEKIT_API_SECRET", LIVEKIT_API_SECRET),
]:
    _logger.info(f"Config: {_key_name}=SET ({len(_value)} chars)")