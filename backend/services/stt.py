import httpx
from backend.logger import get_logger
from backend.config import ELEVENLABS_API_KEY

logger = get_logger(__name__)


async def transcribe(audio_bytes: bytes, mime_type: str) -> str:
    logger.debug(f"STT: received audio — {len(audio_bytes)} bytes, mime_type={mime_type}")
    logger.debug("STT: forced language=en, model=scribe_v1")

    async with httpx.AsyncClient() as client:
        files = {"file": ("audio", audio_bytes, mime_type)}
        data = {
            "model_id": "scribe_v1",
            "language_code": "en",
        }
        headers = {"xi-api-key": ELEVENLABS_API_KEY.strip()}

        response = await client.post(
            "https://api.elevenlabs.io/v1/speech-to-text",
            headers=headers,
            files=files,
            data=data,
            timeout=30.0,
        )

        if not response.is_success:
            logger.error(f"STT: ElevenLabs returned {response.status_code} — {response.text}")
            response.raise_for_status()

        transcript: str = response.json().get("text", "")
        logger.info(f"STT: transcript — {transcript!r}")
        return transcript
