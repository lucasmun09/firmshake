#!/usr/bin/env bash
# Deploy web + Firestore rules to firmshake-prod (empty prod stack).
# Requires prod VITE_* — use .env.production.local (see .env.production.example) or export vars.
# Does NOT touch firmshake-dev / beta data.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_PROD_LOCAL="$ROOT/.env.production.local"
ENV_EXAMPLE="$ROOT/.env.production.example"

echo "==> FirmShake prod deploy (firmshake-prod)"
echo "    Beta data on firmshake-dev is left unchanged."

if [[ ! -f "$ENV_PROD_LOCAL" ]]; then
  echo ""
  echo "WARNING: Missing .env.production.local"
  echo "  Copy from .env.production.example and fill prod Firebase + API values."
  echo "  CI uses GitHub Environment \`prod\` secrets instead."
  echo ""
  if [[ -z "${VITE_FIREBASE_PROJECT_ID:-}" ]]; then
    echo "ERROR: VITE_FIREBASE_PROJECT_ID is not set and no .env.production.local found." >&2
    echo "  Prod builds must NOT reuse .env.local (firmshake-dev)." >&2
    exit 1
  fi
fi

PROJECT_ID="${VITE_FIREBASE_PROJECT_ID:-}"
if [[ -z "$PROJECT_ID" && -f "$ENV_PROD_LOCAL" ]]; then
  PROJECT_ID="$(grep -E '^VITE_FIREBASE_PROJECT_ID=' "$ENV_PROD_LOCAL" | cut -d= -f2- | tr -d \"'\" || true)"
fi

if [[ "$PROJECT_ID" != "firmshake-prod" ]]; then
  echo "ERROR: Refusing prod deploy — VITE_FIREBASE_PROJECT_ID=${PROJECT_ID:-<unset>} (expected firmshake-prod)." >&2
  echo "  Create .env.production.local from .env.production.example with prod SDK config." >&2
  exit 1
fi

echo "==> Building (Vite production mode, firmshake-prod)..."
npm run build -- --mode production

echo "==> Deploying Firestore rules + Hosting to firmshake-prod..."
firebase deploy --only firestore:rules,hosting --project prod

echo ""
echo "==> Done."
echo "    Default URL: https://firmshake-prod.web.app"
echo "    Custom domain cutover (firm-shake.com): see docs/devo-prod-stacks.md"
