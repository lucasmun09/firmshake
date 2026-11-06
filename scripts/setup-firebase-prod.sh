#!/usr/bin/env bash
# Bootstrap firmshake-prod (empty Firestore, hosting site, web app SDK → .env.production.local).
# Safe to re-run. Does NOT copy or delete firmshake-dev data.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export FIREBASE_PROJECT_ID=firmshake-prod
export FIREBASE_DISPLAY_NAME="FirmShake Prod"
export FIREBASE_WEB_APP_NAME="FirmShake Web Prod"
export FIRESTORE_LOCATION="${FIRESTORE_LOCATION:-us-east1}"
export FIREBASE_ENV_FILE="$ROOT/.env.production.local"

echo "==> FirmShake prod Firebase setup (empty stack)"
echo "    Project: $FIREBASE_PROJECT_ID"
echo "    Firestore region: $FIRESTORE_LOCATION"
echo "    Output env: $FIREBASE_ENV_FILE"
echo ""

bash "$ROOT/scripts/setup-firebase.sh"

echo ""
echo "==> Post-setup prod checklist:"
echo "  1. Enable Auth providers on firmshake-prod (Email/Password, Google, SMS MFA)."
echo "  2. Deploy prod API: cd ../firmshake-api && bash scripts/deploy-prod.sh"
echo "  3. Set VITE_API_BASE_URL in .env.production.local with prod Cloud Run URL."
echo "  4. npm run deploy:prod"
echo "  5. Cut custom domain firm-shake.com from firmshake-dev → firmshake-prod (docs/devo-prod-stacks.md)."
