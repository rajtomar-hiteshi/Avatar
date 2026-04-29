import base64
import time

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import StreamingResponse

from backend.logger import get_logger
from backend.services import llm, stt, tts

logger = get_logger(__name__)
router = APIRouter(prefix="/voice")


@router.post("/process")
async def process_voice(audio: UploadFile = File(...)):
    t_start = time.perf_counter()

    audio_bytes = await audio.read()
    mime_type = audio.content_type or "audio/webm"
    if mime_type in ("application/octet-stream", "binary/octet-stream", "application/unknown"):
        mime_type = "audio/webm"
    logger.debug(f"Voice: received upload — {len(audio_bytes)} bytes, mime={mime_type}")

    async def generate_audio_stream():
        full_reply_parts = []
        t_llm_first_chunk = None
        tts_times = []
        chunk_count = 0
        stt_ms = 0

        try:
            # Step 1 — STT
            t_stt_start = time.perf_counter()
            transcript = await stt.transcribe(audio_bytes, mime_type)
            stt_ms = round((time.perf_counter() - t_stt_start) * 1000)
            logger.info(f"Voice: ✅ STT completed in {stt_ms}ms — '{transcript}'")

            yield f"data: TRANSCRIPT:{transcript}\n\n".encode()

            # Step 2+3 — LLM stream → TTS each sentence
            t_llm_start = time.perf_counter()

            async for sentence in llm.stream_reply(transcript):
                if t_llm_first_chunk is None:
                    t_llm_first_chunk = time.perf_counter()
                    llm_first_ms = round((t_llm_first_chunk - t_llm_start) * 1000)
                    logger.info(f"Voice: ✅ LLM first chunk in {llm_first_ms}ms")

                full_reply_parts.append(sentence)
                yield f"data: TEXT:{sentence}\n\n".encode()

                t_tts_chunk = time.perf_counter()
                try:
                    audio_chunk = await tts.synthesize_chunk(sentence)
                    chunk_ms = round((time.perf_counter() - t_tts_chunk) * 1000)
                    tts_times.append(chunk_ms)
                    chunk_count += 1
                    logger.info(
                        f"Voice: ✅ TTS chunk {chunk_count} in {chunk_ms}ms — {len(audio_chunk)} bytes"
                    )
                    audio_b64 = base64.b64encode(audio_chunk).decode("ascii")
                    yield f"data: AUDIO:{audio_b64}\n\n".encode()
                except Exception as tts_err:
                    logger.error(f"Voice: TTS chunk failed — {tts_err}")
                    continue

            full_reply = " ".join(full_reply_parts)
            yield f"data: DONE:{full_reply}\n\n".encode()

        except Exception as exc:
            logger.exception(f"Voice: stream error — {exc}")
            yield f"data: ERROR:{str(exc)}\n\n".encode()
            return

        finally:
            total_ms = round((time.perf_counter() - t_start) * 1000)
            tts_avg = round(sum(tts_times) / len(tts_times)) if tts_times else 0
            llm_first_ms_val = (
                round((t_llm_first_chunk - t_llm_start) * 1000)
                if t_llm_first_chunk is not None
                else 0
            )
            logger.info(
                f"\n╔══════════════════════════════════\n"
                f"║ REQUEST SUMMARY\n"
                f"║ STT  : {stt_ms}ms\n"
                f"║ LLM  : {llm_first_ms_val}ms (first chunk)\n"
                f"║ TTS  : {tts_avg}ms avg per chunk ({chunk_count} chunks)\n"
                f"║ TOTAL: {total_ms}ms\n"
                f"╚══════════════════════════════════"
            )

    return StreamingResponse(
        generate_audio_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Expose-Headers": "*",
        },
    )
