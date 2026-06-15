#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found. Install Node.js 18+ or use Volta/nvm."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: npm not found. Install Node.js with npm."
  exit 1
fi

if [ ! -f "$ROOT_DIR/.env.local" ]; then
  echo "WARNING: No .env.local found. Copy .env.example and configure Firebase."
  echo "         Run: cp .env.example .env.local"
fi

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "==> Installing dependencies..."
  npm install
else
  echo "==> Dependencies already installed"
fi

PORT="${VITE_DEV_PORT:-5173}"

free_port() {
  local port="$1"
  local pids

  if ! command -v lsof >/dev/null 2>&1; then
    echo "WARNING: lsof not found; skipping port check for :$port"
    return 0
  fi

  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -z "$pids" ]; then
    echo "==> Port $port is free"
    return 0
  fi

  echo "==> Port $port in use; stopping process(es): $pids"
  kill $pids 2>/dev/null || true
  sleep 1

  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "==> Force-stopping process(es): $pids"
    kill -9 $pids 2>/dev/null || true
  fi
}

free_port "$PORT"

echo "==> Starting FirmShake web app on http://localhost:$PORT"
exec npm run dev -- --host 0.0.0.0 --port "$PORT"
