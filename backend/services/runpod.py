import httpx
from backend.logger import get_logger
from backend import state

logger = get_logger(__name__)


async def send_text(text: str) -> bool:
    if not state.runpod_url:
        logger.warning("RunPod URL not configured — avatar will not speak")
        return False

    url = f"{state.runpod_url}/human"
    payload = {"text": text, "type": "echo"}
    logger.info(f"RunPod: POST {url} — {repr(text[:80])}")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload)
        if not response.is_success:
            logger.error(f"RunPod: {response.status_code} — {response.text[:200]}")
            return False
        logger.info("RunPod: text sent OK")
        return True
