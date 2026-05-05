import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from backend.logger import get_logger
from backend import state

logger = get_logger(__name__)
router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok", "runpod_url": state.runpod_url or None}


@router.get("/admin/set-pod-url")
async def set_pod_url(url: str):
    state.runpod_url = url.rstrip("/")
    state._save_runpod_url(state.runpod_url)
    logger.info(f"RunPod URL set to: {state.runpod_url}")
    return {"status": "ok", "runpod_url": state.runpod_url}


@router.get("/avatar/config")
async def avatar_config():
    return {"runpod_url": state.runpod_url or ""}


@router.get("/avatar/session")
async def avatar_session():
    if not state.runpod_url:
        return JSONResponse({"error": "RunPod URL not configured"}, status_code=503)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{state.runpod_url}/")
            return JSONResponse(content=response.json(), status_code=response.status_code)
    except Exception as exc:
        logger.error(f"Avatar session proxy error: {exc}")
        return JSONResponse({"error": str(exc)}, status_code=502)


@router.post("/proxy/offer")
async def proxy_offer(request: Request):
    if not state.runpod_url:
        return JSONResponse({"error": "RunPod URL not set"}, status_code=503)
    try:
        body = await request.json()
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{state.runpod_url}/offer", json=body)
            return JSONResponse(content=response.json(), status_code=response.status_code)
    except Exception as exc:
        logger.error(f"Proxy /offer error: {exc}")
        return JSONResponse({"error": str(exc)}, status_code=502)


@router.post("/proxy/human")
async def proxy_human(request: Request):
    if not state.runpod_url:
        return JSONResponse({"error": "RunPod URL not set"}, status_code=503)
    try:
        body = await request.json()
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{state.runpod_url}/human", json=body)
            return JSONResponse(content=response.json(), status_code=response.status_code)
    except Exception as exc:
        logger.error(f"Proxy /human error: {exc}")
        return JSONResponse({"error": str(exc)}, status_code=502)
