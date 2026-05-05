import asyncio
import time
from typing import AsyncGenerator

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


async def synthesize_pcm(text: str, sample_rate: int = 16000) -> bytes:
    """Return raw 16-bit mono PCM bytes at sample_rate Hz (for LiveKit streaming).

    Uses ElevenLabs output_format=pcm_{sample_rate} — no ffmpeg or pydub required.
    """
    t0 = time.monotonic()
    logger.debug(f"TTS: PCM start — {len(text)} chars at {sample_rate}Hz")

    url = (
        f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID.strip()}"
        f"?output_format=pcm_{sample_rate}"
    )
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY.strip(),
        "Content-Type": "application/json",
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
            logger.error(f"TTS: PCM ElevenLabs {response.status_code} — {response.text}")
            response.raise_for_status()

        pcm_bytes = response.content
        elapsed_ms = (time.monotonic() - t0) * 1000
        logger.info(
            f"TTS: PCM synthesis took {elapsed_ms:.0f}ms "
            f"({len(text)} chars → {len(pcm_bytes)} bytes at {sample_rate}Hz)"
        )
        return pcm_bytes


async def synthesize_chunk(text: str) -> bytes:
    """Blocking TTS for a single text chunk. Kept for backward compatibility."""
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


async def stream_tts_sentences(
    text_stream: AsyncGenerator[str, None]
) -> AsyncGenerator[tuple[bytes, dict], None]:
    """
    Low-latency streaming TTS that processes sentences as they arrive.
    
    Yields:
        tuple: (audio_chunk_bytes, metadata_dict)
        
    Metadata includes:
        - sentence: The text that generated this audio
        - chunk_index: Sequential chunk number
        - llm_to_tts_latency_ms: Time from sentence generation to TTS start
        - tts_latency_ms: Time for TTS synthesis
        - total_latency_ms: Time from LLM start to audio ready
    
    This enables:
    - Parallel LLM generation and TTS conversion
    - Immediate audio streaming as chunks become available
    - Detailed latency tracking for optimization
    """
    t_pipeline_start = time.monotonic()
    chunk_index = 0
    
    # Queue to hold (sentence, generation_time) pairs
    sentence_queue = asyncio.Queue()
    
    # Task to feed sentences from LLM stream into queue
    async def sentence_feeder():
        try:
            async for sentence in text_stream:
                gen_time = time.monotonic()
                await sentence_queue.put((sentence, gen_time))
                logger.debug(f"TTS: queued sentence {chunk_index} — {repr(sentence[:40])}")
        except Exception as e:
            logger.error(f"TTS: sentence feeder error — {e}")
        finally:
            await sentence_queue.put(None)  # Sentinel to end processing
    
    # Start the feeder task
    feeder_task = asyncio.create_task(sentence_feeder())
    
    # Process sentences as they arrive (parallel with LLM generation)
    while True:
        item = await sentence_queue.get()
        
        # Check for sentinel
        if item is None:
            break
        
        sentence, gen_time = item
        t_tts_start = time.monotonic()
        
        # Calculate latency from LLM generation to TTS start
        llm_to_tts_latency_ms = (t_tts_start - gen_time) * 1000
        
        logger.info(
            f"TTS: 🚀 Starting chunk {chunk_index} - "
            f"LLM→TTS latency: {llm_to_tts_latency_ms:.0f}ms - "
            f"Text: {repr(sentence[:40])}"
        )
        
        try:
            # Synthesize audio for this sentence
            audio_bytes = await synthesize_chunk(sentence)
            
            t_tts_end = time.monotonic()
            tts_latency_ms = (t_tts_end - t_tts_start) * 1000
            total_latency_ms = (t_tts_end - gen_time) * 1000
            
            metadata = {
                "sentence": sentence,
                "chunk_index": chunk_index,
                "llm_to_tts_latency_ms": round(llm_to_tts_latency_ms, 1),
                "tts_latency_ms": round(tts_latency_ms, 1),
                "total_latency_ms": round(total_latency_ms, 1),
                "audio_bytes": len(audio_bytes),
            }
            
            logger.info(
                f"TTS: ✅ Chunk {chunk_index} ready - "
                f"TTS: {tts_latency_ms:.0f}ms, "
                f"Total: {total_latency_ms:.0f}ms, "
                f"Audio: {len(audio_bytes)} bytes"
            )
            
            yield (audio_bytes, metadata)
            chunk_index += 1
            
        except Exception as e:
            logger.error(f"TTS: chunk {chunk_index} failed — {e}")
            # Continue processing even if one chunk fails
            chunk_index += 1
    
    # Wait for feeder to complete
    await feeder_task
    
    total_pipeline_ms = (time.monotonic() - t_pipeline_start) * 1000
    logger.info(f"TTS: 🏁 Pipeline complete - {chunk_index} chunks in {total_pipeline_ms:.0f}ms")


async def stream_tts_with_latency_tracking(
    text_stream: AsyncGenerator[str, None]
) -> AsyncGenerator[tuple[bytes, dict], None]:
    """
    Alias for stream_tts_sentences with enhanced logging.
    Provides the same interface for backward compatibility.
    """
    async for audio_chunk, metadata in stream_tts_sentences(text_stream):
        # Add additional latency context
        metadata["streaming_mode"] = "sentence_level_pseudo_streaming"
        metadata["audio_format"] = "mp3"
        yield (audio_chunk, metadata)
