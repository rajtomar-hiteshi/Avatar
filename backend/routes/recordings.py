import os
import uuid
from datetime import datetime

from fastapi import APIRouter, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse

from backend.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

RECORDINGS_DIR = "/home/ubuntu/Avatar/recordings"
# Local dev fallback
if not os.path.exists("/home/ubuntu"):
    RECORDINGS_DIR = os.path.join(os.path.dirname(__file__), "../../recordings")

os.makedirs(RECORDINGS_DIR, exist_ok=True)


@router.post("/upload")
async def upload_recording(file: UploadFile = File(...)):
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        filename = f"session_{timestamp}_{uuid.uuid4().hex[:6]}.webm"
        filepath = os.path.join(RECORDINGS_DIR, filename)

        content = await file.read()
        with open(filepath, "wb") as f:
            f.write(content)

        size_mb = round(len(content) / (1024 * 1024), 2)
        logger.info(f"Recording: saved {filename} ({size_mb} MB)")

        return JSONResponse({
            "success": True,
            "filename": filename,
            "size_mb": size_mb,
            "timestamp": timestamp,
        })
    except Exception as e:
        logger.error(f"Recording upload failed: {e}")
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


@router.get("/list")
async def list_recordings():
    try:
        files = []
        for fname in sorted(os.listdir(RECORDINGS_DIR), reverse=True):
            if fname.endswith(".webm"):
                fpath = os.path.join(RECORDINGS_DIR, fname)
                stat = os.stat(fpath)
                files.append({
                    "filename": fname,
                    "size_mb": round(stat.st_size / (1024 * 1024), 2),
                    "created_at": datetime.fromtimestamp(stat.st_ctime).strftime("%Y-%m-%d %H:%M:%S"),
                    "url": f"/recordings/file/{fname}",
                })
        logger.info(f"Recording: listed {len(files)} recordings")
        return JSONResponse({"recordings": files})
    except Exception as e:
        logger.error(f"Recording list failed: {e}")
        return JSONResponse({"recordings": [], "error": str(e)}, status_code=500)


@router.get("/file/{filename}")
async def serve_recording(filename: str):
    filepath = os.path.join(RECORDINGS_DIR, filename)
    if not os.path.exists(filepath):
        return JSONResponse({"error": "File not found"}, status_code=404)
    return FileResponse(filepath, media_type="video/webm", filename=filename)


@router.delete("/delete/{filename}")
async def delete_recording(filename: str):
    filepath = os.path.join(RECORDINGS_DIR, filename)
    if os.path.exists(filepath):
        os.remove(filepath)
        logger.info(f"Recording: deleted {filename}")
        return JSONResponse({"success": True})
    return JSONResponse({"error": "File not found"}, status_code=404)
