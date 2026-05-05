#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Avatar Voice Agent — setup ==="

# ── Node.js 20 ─────────────────────────────────────────────
if ! node --version 2>/dev/null | grep -q "^v20"; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "Node: $(node --version)"
echo "npm:  $(npm --version)"

# ── Python 3.11 ────────────────────────────────────────────
if ! python3.11 --version &>/dev/null; then
  echo "Installing Python 3.11..."
  sudo apt-get install -y python3.11 python3.11-venv python3.11-dev
fi
echo "Python: $(python3.11 --version)"

# ── Python venv + deps ─────────────────────────────────────
if [ ! -d venv ]; then
  python3.11 -m venv venv
fi
source venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
echo "Python deps installed."

# ── Frontend deps + build ──────────────────────────────────
cd "$REPO_ROOT/frontend"
npm install --silent
npm run build
echo "Frontend built → frontend/dist/"

echo ""
echo "=== Setup complete ==="
echo "Next: copy .env.example to .env and fill in your keys, then run deploy/start.sh"
