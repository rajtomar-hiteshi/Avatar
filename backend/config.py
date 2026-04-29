import os
from pathlib import Path
from dotenv import load_dotenv
from backend.logger import get_logger

_logger = get_logger(__name__)

# Always resolve .env relative to this file (AI/.env), regardless of CWD
_env_path = Path(__file__).parent.parent / ".env"
_loaded = load_dotenv(_env_path)
_logger.info(f"Config: .env loaded={_loaded} path={_env_path}")

GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip()
ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "").strip()
ELEVENLABS_VOICE_ID: str = os.getenv("ELEVENLABS_VOICE_ID", "").strip()

for _key_name, _value in [
    ("GROQ_API_KEY", GROQ_API_KEY),
    ("ELEVENLABS_API_KEY", ELEVENLABS_API_KEY),
    ("ELEVENLABS_VOICE_ID", ELEVENLABS_VOICE_ID),
]:
    _logger.info(f"Config: {_key_name}={'SET ('+str(len(_value))+' chars)' if _value else 'MISSING'}")
    if not _value:
        raise ValueError(f"Missing required environment variable: {_key_name}")
