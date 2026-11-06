#!/usr/bin/env bash
# Dry-run dual-stack web env asserts (no vite build / firebase deploy).
# Usage:
#   preflight-hosting.sh deovo [.env.local]
#   preflight-hosting.sh prod [.env.production.local]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STACK="${1:-}"
ENV_FILE="${2:-}"

if [[ -z "$STACK" ]]; then
  echo "Usage: $0 deovo|prod [env_file]" >&2
  exit 2
fi

case "$STACK" in
  deovo|devo)
    bash "$ROOT/scripts/assert-baked-stack.sh" env-devo "${ENV_FILE:-$ROOT/.env.local}"
    ;;
  prod|production)
    bash "$ROOT/scripts/assert-baked-stack.sh" env-prod "${ENV_FILE:-$ROOT/.env.production.local}"
    ;;
  *)
    echo "Unknown stack: $STACK" >&2
    exit 2
    ;;
esac

echo "Preflight OK for ${STACK} (env assert only — no build/deploy)."
