import time

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import StreamingResponse

from backend.logger import get_logger
from backend.services import llm, stt, runpod

logger = get_logger(__name__)
router = APIRouter(prefix="/voice")


@router.post("/process")
async def process_voice(audio: UploadFile = File(...)):
    t_start = time.perf_counter()

    audio_bytes = await audio.read()
    mime_type = audio.content_type or "audio/webm"
    if mime_type in ("application/octet-stream", "binary/octet-stream", "application/unknown"):
        mime_type = "audio/webm"

    logger.debug(f"Voice: received {len(audio_bytes)} bytes, mime={mime_type}")

    async def generate():
        try:
            # Step 1 — STT
            t0 = time.perf_counter()
            transcript = await stt.transcribe(audio_bytes, mime_type)
            stt_ms = round((time.perf_counter() - t0) * 1000)
            logger.info(f"STT: {stt_ms}ms — {transcript!r}")
            yield f"data: TRANSCRIPT:{transcript}\n\n".encode()

            # Step 2 — LLM
            t0 = time.perf_counter()
            reply = await llm.get_reply(transcript)
            llm_ms = round((time.perf_counter() - t0) * 1000)
            logger.info(f"LLM: {llm_ms}ms — {reply!r}")
            yield f"data: REPLY:{reply}\n\n".encode()

            # Step 3 — Send to RunPod avatar (RunPod handles TTS + lip-sync)
            t0 = time.perf_counter()
            sent = await runpod.send_text(reply)
            runpod_ms = round((time.perf_counter() - t0) * 1000)
            if sent:
                logger.info(f"RunPod: {runpod_ms}ms — text dispatched to avatar")
                yield f"data: AVATAR_SENT\n\n".encode()

            total_ms = round((time.perf_counter() - t_start) * 1000)
            logger.info(
                f"Pipeline: STT={stt_ms}ms LLM={llm_ms}ms RunPod={runpod_ms}ms total={total_ms}ms"
            )
            yield f"data: DONE:{reply}\n\n".encode()

        except Exception as exc:
            logger.exception(f"Voice pipeline error: {exc}")
            yield f"data: ERROR:{str(exc)}\n\n".encode()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
