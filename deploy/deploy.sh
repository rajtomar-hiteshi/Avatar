#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
BRANCH="${1:-avatar-integration}"

echo "=== Deploy: branch=$BRANCH ==="

# Pull latest
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

# Re-run setup (idempotent — installs/builds only what changed)
bash deploy/setup.sh

# Restart services gracefully
echo "Restarting services..."

# Kill old instances if running under systemd or by name
pkill -f "uvicorn backend.main:app" || true
pkill -f "serve -s frontend/dist" || true
pkill -f "vite" || true

sleep 1

# Start fresh
bash deploy/start.sh
