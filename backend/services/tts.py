import time

import httpx
from backend.config import ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID
from backend.logger import get_logger

logger = get_logger(__name__)


async def synthesize(text: str) -> bytes:
    logger.debug(f"TTS: synthesizing {len(text)} chars — {repr(text[:60])}")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID.strip()}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY.strip(),
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }

    payload = {
        "text": text,
        "model_id": "eleven_turbo_v2_5",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.0,
            "use_speaker_boost": True,
        },
    }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(url, headers=headers, json=payload)

        if response.status_code != 200:
            logger.error(f"TTS: ElevenLabs {response.status_code} — {response.text}")
            response.raise_for_status()

        audio_bytes = response.content
        logger.debug(f"TTS: returned {len(audio_bytes)} bytes of audio")
        return audio_bytes


async def synthesize_chunk(text: str) -> bytes:
    t0 = time.monotonic()
    logger.debug(f"TTS: chunk start — {len(text)} chars — {repr(text[:40])}")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID.strip()}"

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY.strip(),
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }

    payload = {
        "text": text,
        "model_id": "eleven_turbo_v2_5",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.0,
            "use_speaker_boost": True,
        },
        "optimize_streaming_latency": 4,
    }

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(url, headers=headers, json=payload)

        if response.status_code != 200:
            logger.error(f"TTS: chunk ElevenLabs {response.status_code} — {response.text}")
            response.raise_for_status()

        audio_bytes = response.content
        elapsed_ms = (time.monotonic() - t0) * 1000
        logger.info(
            f"TTS: ⏱ Chunk synthesis took {elapsed_ms:.0f}ms ({len(text)} chars → {len(audio_bytes)} bytes)"
        )
        return audio_bytes
