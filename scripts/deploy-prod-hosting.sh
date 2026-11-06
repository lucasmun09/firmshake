#!/usr/bin/env bash
# Deploy web + Firestore rules to firmshake-prod (empty prod stack).
# Requires prod VITE_* — use .env.production.local (see .env.production.example) or export vars.
# Does NOT touch firmshake-dev / beta data.
# Refuses placeholder API URLs and deovo Firebase hosts in dist.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ASSERT="$ROOT/scripts/assert-baked-stack.sh"
ENV_PROD_LOCAL="$ROOT/.env.production.local"
DIST_DIR="$ROOT/dist"

echo "==> FirmShake prod deploy (firmshake-prod)"
echo "    Beta data on firmshake-dev is left unchanged."

if [[ ! -f "$ENV_PROD_LOCAL" ]]; then
  echo ""
  echo "WARNING: Missing .env.production.local"
  echo "  Copy from .env.production.example and fill prod Firebase + API values."
  echo "  Or run: npm run firebase:setup:prod"
  echo "  CI uses GitHub Environment \`prod\` secrets instead."
  echo ""
  if [[ -z "${VITE_FIREBASE_PROJECT_ID:-}" || -z "${VITE_API_BASE_URL:-}" ]]; then
    echo "ERROR: Prod deploy needs .env.production.local or exported VITE_FIREBASE_PROJECT_ID + VITE_API_BASE_URL." >&2
    exit 1
  fi
  if [[ "${VITE_FIREBASE_PROJECT_ID}" != "firmshake-prod" ]]; then
    echo "ERROR: Refusing prod deploy — VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID} (expected firmshake-prod)." >&2
    exit 1
  fi
  if [[ "${VITE_API_BASE_URL}" == *REPLACE* || "${VITE_API_BASE_URL}" == *firmshake-api-staging* ]]; then
    echo "ERROR: Refusing prod deploy — VITE_API_BASE_URL is placeholder/staging." >&2
    exit 1
  fi
else
  bash "$ASSERT" env-prod "$ENV_PROD_LOCAL"
fi

PROJECT_ID="${VITE_FIREBASE_PROJECT_ID:-}"
if [[ -z "$PROJECT_ID" && -f "$ENV_PROD_LOCAL" ]]; then
  PROJECT_ID="$(grep -E '^VITE_FIREBASE_PROJECT_ID=' "$ENV_PROD_LOCAL" | cut -d= -f2- | tr -d \"'\" || true)"
fi

if [[ "$PROJECT_ID" != "firmshake-prod" ]]; then
  echo "ERROR: Refusing prod deploy — VITE_FIREBASE_PROJECT_ID=${PROJECT_ID:-<unset>} (expected firmshake-prod)." >&2
  exit 1
fi

echo "==> Building (Vite production mode, firmshake-prod)..."
npm run build -- --mode production

bash "$ASSERT" prod "$DIST_DIR"

echo "==> Deploying Firestore rules + Hosting to firmshake-prod..."
firebase deploy --only firestore:rules,hosting --project prod

echo ""
echo "==> Done."
echo "    Default URL: https://firmshake-prod.web.app"
echo "    Verify browse is EMPTY (no beta listings) before DNS cutover."
echo "    Custom domain cutover (firm-shake.com): see docs/devo-prod-stacks.md"
