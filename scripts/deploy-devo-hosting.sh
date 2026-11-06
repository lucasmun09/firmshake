#!/usr/bin/env bash
# Deploy web to firmshake-dev (devo/beta).
# Uses Vite --mode devo so .env.production.local (prod) is NEVER loaded.
# See docs/devo-prod-stacks.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ASSERT="$ROOT/scripts/assert-baked-stack.sh"
ENV_LOCAL="$ROOT/.env.local"
DIST_DIR="$ROOT/dist"

echo "==> FirmShake deovo deploy (firmshake-dev)"
echo "    Uses Vite mode devo (loads .env.local / .env.devo*, not .env.production*)."
echo "    Note: firm-shake.com currently shares this Hosting site until DNS cutover."

if [[ -f "$ENV_LOCAL" ]]; then
  bash "$ASSERT" env-devo "$ENV_LOCAL"
else
  echo "WARNING: .env.local missing — relying on CI/exported VITE_* for firmshake-dev."
fi

PROJECT_ID="${VITE_FIREBASE_PROJECT_ID:-}"
if [[ -z "$PROJECT_ID" && -f "$ENV_LOCAL" ]]; then
  PROJECT_ID="$(sed -n 's/^VITE_FIREBASE_PROJECT_ID=//p' "$ENV_LOCAL" | head -n1 | sed 's/[\"\x27]//g')"
fi

if [[ -n "$PROJECT_ID" && "$PROJECT_ID" != "firmshake-dev" ]]; then
  echo "ERROR: Refusing deovo deploy - VITE_FIREBASE_PROJECT_ID=${PROJECT_ID} (expected firmshake-dev)." >&2
  exit 1
fi

echo "==> Building (Vite mode devo, firmshake-dev)..."
npm run build:devo

bash "$ASSERT" deovo "$DIST_DIR"

echo "==> Deploying Hosting to firmshake-dev..."
firebase deploy --only hosting --project devo

echo ""
echo "==> Done."
echo "    URL: https://firmshake-dev.web.app"
echo "    Until cutover, https://firm-shake.com serves THIS same site (same listings)."
echo "    Prod (empty) will be https://firmshake-prod.web.app after npm run deploy:prod."
