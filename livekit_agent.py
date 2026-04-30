"""
LiveKit Agent — standalone process (run separately from FastAPI).

Connects to a LiveKit room as 'backend-agent', subscribes to audio tracks
from all participants, and pipes audio through the existing STT → LLM pipeline.

Run:
    python livekit_agent.py
    # or specify a room:
    python livekit_agent.py --room avatar-room

TTS audio is synthesized as raw PCM via ElevenLabs and streamed back through LiveKit.
"""

import argparse
import asyncio
import io
import re
import sys
import time
import wave

# Ensure the project root is on sys.path so backend imports resolve
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from livekit import rtc
from livekit.api import AccessToken, VideoGrants

from backend.config import LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
from backend.logger import get_logger
from backend.services import stt, llm, tts

logger = get_logger("livekit_agent")


def log(stage: str, message: str) -> None:
    """Structured stage logger — always flushes so output is real-time."""
    print(f"[{stage:<7}] {message}", flush=True)

# Matches transcripts that are purely noise labels, e.g. "(traffic sounds)", "(music)"
_NOISE_RE = re.compile(r'^\s*(\([^)]*\)\s*)+$')


def _is_noise(transcript: str) -> bool:
    """Return True when the transcript contains no real speech words."""
    t = transcript.strip()
    if not t:
        return True
    if _NOISE_RE.match(t):
        return True
    # Strip all parenthetical groups and punctuation; check nothing real remains
    cleaned = re.sub(r'\([^)]*\)', '', t)
    words = [w.strip('.,!?;:"-') for w in cleaned.split()]
    return not any(words)


def is_complete_sentence(text: str) -> bool:
    """Return False for partial phrases that should not trigger LLM."""
    t = text.strip()
    if not t:
        return False
    # Trailing connectors / punctuation indicate the user hasn't finished
    if t.endswith(("...", "-", ",", " and", " so", " but", " or")):
        return False
    # Require at least 3 words to avoid spurious single-word triggers
    if len(t.split()) < 3:
        return False
    return True


AGENT_IDENTITY = "backend-agent"
AGENT_NAME = "Avatar Backend Agent"

# How many seconds of audio to buffer before sending to STT
BUFFER_SECONDS = 2.0

# Audio output constants (must match what LiveKit expects)
SAMPLE_RATE = 16000
FRAME_DURATION_MS = 100
FRAME_SIZE = int(SAMPLE_RATE * (FRAME_DURATION_MS / 1000) * 2)  # 3200 bytes = 100ms at 16kHz

# Serialize concurrent TTS streams so voices never overlap
_tts_lock = asyncio.Lock()

# Queues LLM responses for sequential TTS playback — no responses are ever dropped
response_queue: asyncio.Queue = asyncio.Queue()


def _frames_to_wav(frames: list) -> bytes:
    """Convert a list of livekit AudioFrame objects into WAV bytes (16-bit PCM)."""
    if not frames:
        return b""

    sample_rate: int = frames[0].sample_rate
    num_channels: int = frames[0].num_channels

    pcm_data = b""
    for frame in frames:
        pcm_data += bytes(frame.data)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(num_channels)
        wf.setsampwidth(2)  # 16-bit = 2 bytes per sample
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_data)

    return buf.getvalue()


async def stream_audio_to_livekit(audio_source: rtc.AudioSource, pcm_data: bytes) -> None:
    """Push raw 16-bit mono PCM through LiveKit AudioSource in real time."""
    async with _tts_lock:
        log("STREAM", "Acquired TTS lock")
        total_frames = 0

        for offset in range(0, len(pcm_data), FRAME_SIZE):
            chunk = pcm_data[offset : offset + FRAME_SIZE]
            # Pad the last short chunk to a full frame (silence padding)
            if len(chunk) < FRAME_SIZE:
                chunk = chunk + b"\x00" * (FRAME_SIZE - len(chunk))

            samples_per_channel = len(chunk) // 2

            frame = rtc.AudioFrame(
                data=chunk,
                sample_rate=SAMPLE_RATE,
                num_channels=1,
                samples_per_channel=samples_per_channel,
            )
            await audio_source.capture_frame(frame)

            if total_frames == 0:
                log("STREAM", f"Streaming started immediately — {len(chunk)} bytes/frame, {SAMPLE_RATE}Hz")

            total_frames += 1
            # Pace at real-time rate so the buffer never overflows
            await asyncio.sleep(FRAME_DURATION_MS / 1000)

        log("STREAM", f"Completed — {total_frames} frames, {len(pcm_data)} bytes (lock released)")


async def tts_worker(audio_source: rtc.AudioSource) -> None:
    """Background worker — dequeues LLM responses and plays TTS one at a time."""
    log("SYSTEM", "TTS worker started")
    while True:
        full_reply, t_pipeline_start = await response_queue.get()
        log("TTS", f"Dequeued: {full_reply[:60]!r}")

        try:
            # Brief pause so any trailing user speech is not clipped by TTS start
            await asyncio.sleep(0.2)

            # --- TTS synthesis ---
            t_tts = time.monotonic()
            pcm_bytes = await tts.synthesize_pcm(full_reply, sample_rate=SAMPLE_RATE)
            tts_s = time.monotonic() - t_tts

            if not pcm_bytes:
                log("ERROR", "TTS returned empty audio — skipping")
                continue
            if len(pcm_bytes) % 2 != 0:
                log("ERROR", f"PCM byte count {len(pcm_bytes)} not divisible by 2 — skipping")
                continue

            duration_s = len(pcm_bytes) / (SAMPLE_RATE * 2)
            log("TTS", f"Generated in {tts_s:.2f}s — {len(pcm_bytes)} bytes, duration≈{duration_s:.2f}s")

            # --- Stream to LiveKit ---
            t_stream = time.monotonic()
            await stream_audio_to_livekit(audio_source, pcm_bytes)
            stream_s = time.monotonic() - t_stream
            log("STREAM", f"Completed in {stream_s:.2f}s")

            total_latency = time.monotonic() - t_pipeline_start
            log("SYSTEM", f"Total latency — TTS={tts_s:.2f}s  STREAM={stream_s:.2f}s  END-TO-END={total_latency:.2f}s")

        except Exception as exc:
            log("ERROR", f"TTS worker error: {exc}")
            logger.error("TTS worker exception", exc_info=True)

        finally:
            response_queue.task_done()


async def _run_pipeline(audio_bytes: bytes, participant_identity: str, audio_source: rtc.AudioSource) -> None:
    """Send buffered audio through the existing STT → LLM pipeline."""
    log("USER", f"Speech detected — participant='{participant_identity}'")
    t_total = time.monotonic()

    # End-of-speech buffer: let the user finish any trailing word
    await asyncio.sleep(0.3)

    try:
        # --- Step 1: STT ---
        t_stt = time.monotonic()
        transcript = await stt.transcribe(audio_bytes, "audio/wav")
        stt_s = time.monotonic() - t_stt

        if _is_noise(transcript):
            log("STT", f"Noise detected → skipped ({stt_s:.2f}s)")
            return

        log("STT", f"Text: {transcript!r} ({stt_s:.2f}s)")

        if not is_complete_sentence(transcript):
            log("STT", f"Incomplete speech → waiting ('{transcript.strip()}'")
            return

        # --- Step 2: LLM ---
        t_llm = time.monotonic()
        full_reply_parts = []
        async for sentence in llm.stream_reply(transcript):
            full_reply_parts.append(sentence)
            log("LLM", f"Chunk: {sentence!r}")

        full_reply = " ".join(full_reply_parts)
        llm_s = time.monotonic() - t_llm
        log("LLM", f"Response generated ({llm_s:.2f}s): {full_reply!r}")

        # --- Step 3: Queue (text, pipeline_start_time) for TTS worker ---
        await response_queue.put((full_reply, t_total))
        log("QUEUE", f"Added to queue (size={response_queue.qsize()})")

        total_s = time.monotonic() - t_total
        log("SYSTEM", f"Pipeline — STT={stt_s:.2f}s  LLM={llm_s:.2f}s  total={total_s:.2f}s")

    except Exception as exc:
        log("ERROR", f"Pipeline failed for '{participant_identity}' — {exc}")
        logger.error("Pipeline error", exc_info=True)


async def _handle_audio_track(
    track: rtc.Track,
    participant: rtc.RemoteParticipant,
    audio_source: rtc.AudioSource,
) -> None:
    """Drain an audio stream, buffer frames, then call the pipeline."""
    log("AUDIO", f"Listening to track from '{participant.identity}'")

    audio_stream = rtc.AudioStream(track)
    frames_buffer: list = []
    sample_rate: int | None = None
    _frame_count = 0

    async for event in audio_stream:
        frame = event.frame
        _frame_count += 1

        if sample_rate is None:
            sample_rate = frame.sample_rate

        frames_buffer.append(frame)

        # Log every 50th frame to confirm audio is flowing without spamming
        if _frame_count % 50 == 0:
            log("AUDIO", f"Received frame #{_frame_count} — size={len(frame.data)} bytes")

        # samples_per_channel × num_channels × 2 bytes = frame byte size
        total_samples = sum(f.samples_per_channel for f in frames_buffer)
        buffered_seconds = total_samples / sample_rate if sample_rate else 0
        buffered_bytes = sum(len(bytes(f.data)) for f in frames_buffer)

        if buffered_seconds >= BUFFER_SECONDS:
            log("BUFFER", f"Buffer full ({buffered_seconds:.1f}s / {buffered_bytes} bytes) → sending to STT")
            wav_bytes = _frames_to_wav(frames_buffer)
            frames_buffer = []
            asyncio.ensure_future(
                _run_pipeline(wav_bytes, participant.identity, audio_source)
            )


async def run_agent(room_name: str) -> None:
    """Connect to LiveKit, join the room, and start listening."""
    if not LIVEKIT_URL:
        log("ERROR", "LIVEKIT_URL is not set — check your .env file")
        sys.exit(1)
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        log("ERROR", "LIVEKIT_API_KEY / LIVEKIT_API_SECRET not set — check your .env file")
        sys.exit(1)

    # Generate an agent token
    token = (
        AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(AGENT_IDENTITY)
        .with_name(AGENT_NAME)
        .with_grants(
            VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
            )
        )
        .to_jwt()
    )

    room = rtc.Room()

    # Agent audio output — one source shared across all pipeline calls
    audio_source = rtc.AudioSource(sample_rate=SAMPLE_RATE, num_channels=1)
    audio_track = rtc.LocalAudioTrack.create_audio_track("agent-voice", audio_source)

    # Start background TTS worker (serialises all TTS + stream calls)
    asyncio.create_task(tts_worker(audio_source))

    # --- Event: new track subscribed ---
    @room.on("track_subscribed")
    def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            log("CONNECT", f"Subscribed to audio track — participant='{participant.identity}'")
            asyncio.ensure_future(_handle_audio_track(track, participant, audio_source))

    # --- Event: participant joined ---
    @room.on("participant_connected")
    def on_participant_connected(participant: rtc.RemoteParticipant):
        log("CONNECT", f"User joined: {participant.identity}")

    # --- Event: participant left ---
    @room.on("participant_disconnected")
    def on_participant_disconnected(participant: rtc.RemoteParticipant):
        log("CONNECT", f"User left: {participant.identity}")

    # --- Connect ---
    await room.connect(LIVEKIT_URL, token)
    await room.local_participant.publish_track(audio_track)
    log("CONNECT", f"Agent connected to room '{room_name}' as '{AGENT_IDENTITY}'")
    log("CONNECT", "Agent audio track published — users will hear TTS responses")
    log("CONNECT", "Waiting for participants… (Ctrl+C to stop)")

    try:
        await asyncio.sleep(float("inf"))
    except (asyncio.CancelledError, KeyboardInterrupt):
        log("CONNECT", "Shutting down agent")
    finally:
        await room.disconnect()
        log("CONNECT", "Disconnected")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LiveKit backend audio agent")
    parser.add_argument("--room", default="avatar-room", help="LiveKit room name to join")
    args = parser.parse_args()

    asyncio.run(run_agent(args.room))
