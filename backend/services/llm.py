import time
from typing import AsyncGenerator

from openai import AsyncOpenAI
from backend.logger import get_logger
from backend.config import GROQ_API_KEY

logger = get_logger(__name__)

_client = AsyncOpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)

_SYSTEM_PROMPT = (
    "You are a helpful, concise voice assistant. "
    "CRITICAL RULE: You MUST reply in English ONLY. "
    "No matter what language the user speaks — Hindi, Spanish, French, or any other — your response MUST be in English. "
    "Never switch languages. Never mix languages. English only, always. "
    "Keep every reply under 150 characters total — short, spoken responses only. 1-2 sentences max."
)


async def get_reply(user_text: str) -> str:
    logger.debug(f"LLM: sending question — {user_text!r}")

    response = await _client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_text},
        ],
    )

    reply: str = response.choices[0].message.content
    logger.info(f"LLM: reply — {reply!r}")
    return reply


async def stream_reply(user_text: str) -> AsyncGenerator[str, None]:
    logger.debug(f"LLM: streaming question — {user_text!r}")
    t0 = time.monotonic()

    buffer = ""
    total_chars = 0
    total_raw_chunks = 0

    stream = await _client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_text},
        ],
        stream=True,
    )

    logger.debug("LLM: stream started")

    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta is None:
            continue

        total_raw_chunks += 1
        buffer += delta

        # Drain complete sentences from the buffer
        while True:
            end_idx = -1
            for i, ch in enumerate(buffer):
                if ch in ".!?\n":
                    end_idx = i
                    break

            if end_idx >= 0:
                sentence = buffer[: end_idx + 1].strip()
                buffer = buffer[end_idx + 1 :]
                if sentence:
                    total_chars += len(sentence)
                    logger.debug(f"LLM: yielding sentence — {sentence!r}")
                    yield sentence
            elif len(buffer) > 120:
                # Yield at word boundary to avoid cutting mid-word
                last_space = buffer.rfind(" ")
                if last_space > 0:
                    phrase = buffer[:last_space].strip()
                    buffer = buffer[last_space:]
                else:
                    phrase = buffer.strip()
                    buffer = ""
                if phrase:
                    total_chars += len(phrase)
                    logger.debug(f"LLM: yielding long chunk — {phrase!r}")
                    yield phrase
                break
            else:
                break

    if buffer.strip():
        remainder = buffer.strip()
        total_chars += len(remainder)
        logger.debug(f"LLM: yielding remainder — {remainder!r}")
        yield remainder

    elapsed_ms = (time.monotonic() - t0) * 1000
    logger.info(
        f"LLM: stream complete — {total_chars} chars, {total_raw_chunks} raw chunks, {elapsed_ms:.1f}ms"
    )
