import os
import subprocess
import uuid
from datetime import datetime

from fastapi import APIRouter, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse

from backend.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

RECORDINGS_DIR = "/home/ubuntu/Avatar/recordings"
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

        # Convert webm → mp4 for maximum playback compatibility
        mp4_filename = filename.replace('.webm', '.mp4')
        mp4_path = os.path.join(RECORDINGS_DIR, mp4_filename)

        try:
            result = subprocess.run([
                'ffmpeg', '-i', filepath,
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-strict', 'experimental',
                '-y',
                mp4_path
            ], capture_output=True, text=True, timeout=300)

            if result.returncode == 0:
                os.remove(filepath)
                logger.info(f"Recording: converted to mp4 — {mp4_filename}")
                final_filename = mp4_filename
                final_path = mp4_path
            else:
                logger.warning(f"Recording: ffmpeg failed, keeping webm — {result.stderr}")
                final_filename = filename
                final_path = filepath
        except Exception as e:
            logger.warning(f"Recording: ffmpeg not available, keeping webm — {e}")
            final_filename = filename
            final_path = filepath

        return JSONResponse({
            "success": True,
            "filename": final_filename,
            "size_mb": round(os.path.getsize(final_path) / (1024 * 1024), 2),
            "timestamp": timestamp,
            "format": "mp4" if final_filename.endswith('.mp4') else "webm"
        })
    except Exception as e:
        logger.error(f"Recording upload failed: {e}")
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


@router.get("/list")
async def list_recordings():
    try:
        files = []
        for fname in sorted(os.listdir(RECORDINGS_DIR), reverse=True):
            if fname.endswith(".webm") or fname.endswith(".mp4"):
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
    media_type = "video/mp4" if filename.endswith(".mp4") else "video/webm"
    return FileResponse(filepath, media_type=media_type, filename=filename)


@router.delete("/delete/{filename}")
async def delete_recording(filename: str):
    filepath = os.path.join(RECORDINGS_DIR, filename)
    if os.path.exists(filepath):
        os.remove(filepath)
        logger.info(f"Recording: deleted {filename}")
        return JSONResponse({"success": True})
    return JSONResponse({"error": "File not found"}, status_code=404)
