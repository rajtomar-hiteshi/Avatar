from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import JSONResponse
from livekit.api import AccessToken, VideoGrants

from backend.config import LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
from backend.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.get("/livekit-token")
async def get_livekit_token(
    room: str = Query(..., description="LiveKit room name"),
    identity: str = Query(..., description="Participant identity"),
):
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        raise HTTPException(status_code=503, detail="LiveKit credentials not configured on server")

    token = (
        AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(identity)
        .with_name(identity)
        .with_grants(
            VideoGrants(
                room_join=True,
                room=room,
                can_publish=True,
                can_subscribe=True,
            )
        )
        .to_jwt()
    )

    logger.info(f"LiveKit: issued token — room={room!r} identity={identity!r}")
    return JSONResponse({"token": token, "url": LIVEKIT_URL})
