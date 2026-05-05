#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.example → .env and fill in your keys."
  exit 1
fi

echo "=== Starting Avatar Voice Agent ==="

# ── Backend ────────────────────────────────────────────────
source venv/bin/activate
echo "Starting backend on port 8000..."
uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# ── Frontend ───────────────────────────────────────────────
# Serves the Vite-built static files from backend, OR starts the dev server.
if [ -d frontend/dist ]; then
  # Serve built frontend via a lightweight static server on port 3000
  echo "Serving built frontend on port 3000..."
  npx --yes serve -s frontend/dist -l 3000 &
  FRONTEND_PID=$!
  echo "Frontend PID: $FRONTEND_PID"
else
  echo "No frontend/dist found — starting Vite dev server on port 3000..."
  cd frontend && npm run dev &
  FRONTEND_PID=$!
  echo "Frontend PID: $FRONTEND_PID"
fi

echo ""
echo "=== Running ==="
echo "  Backend:  http://0.0.0.0:8000"
echo "  Frontend: http://0.0.0.0:3000"
echo ""
echo "Press Ctrl+C to stop both services."

# Graceful shutdown
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT INT TERM
wait
