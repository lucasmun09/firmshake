#!/usr/bin/env bash
# Assert a Vite dist/ (or env file) matches the intended FirmShake stack.
# Usage:
#   assert-baked-stack.sh deovo [dist_dir]
#   assert-baked-stack.sh prod [dist_dir]
#   assert-baked-stack.sh env-devo [env_file]
#   assert-baked-stack.sh env-prod [env_file]
set -euo pipefail

STACK="${1:-}"
TARGET="${2:-}"

if [[ -z "$STACK" ]]; then
  echo "Usage: $0 deovo|prod|env-devo|env-prod [path]" >&2
  exit 2
fi

dist_has() {
  local dir="$1"
  local needle="$2"
  grep -R --include='*.js' --include='*.json' --include='*.html' -F -q -- "$needle" "$dir"
}

assert_dist_devo() {
  local dir="${1:-dist}"
  if [[ ! -d "$dir" ]]; then
    echo "ERROR: dist dir missing: $dir" >&2
    exit 1
  fi
  # appStack.ts mentions firmshake-prod as a constant — detect real SDK hosts instead.
  if dist_has "$dir" firmshake-prod.firebaseapp.com || dist_has "$dir" firmshake-prod.firebasestorage.app; then
    echo "ERROR: Refusing deovo — $dir contains firmshake-prod Firebase hosts (prod config baked in)." >&2
    exit 1
  fi
  if ! dist_has "$dir" firmshake-dev.firebaseapp.com; then
    echo "ERROR: Refusing deovo — $dir missing firmshake-dev.firebaseapp.com." >&2
    exit 1
  fi
  if dist_has "$dir" REPLACE-ME-firmshake-api || dist_has "$dir" REPLACE_ME; then
    echo "ERROR: Refusing deovo — $dir contains placeholder API/config values." >&2
    exit 1
  fi
  echo "OK: $dir looks like firmshake-dev (devo)."
}

assert_dist_prod() {
  local dir="${1:-dist}"
  if [[ ! -d "$dir" ]]; then
    echo "ERROR: dist dir missing: $dir" >&2
    exit 1
  fi
  if dist_has "$dir" firmshake-dev.firebaseapp.com || dist_has "$dir" firmshake-dev.firebasestorage.app; then
    echo "ERROR: Refusing prod — $dir contains firmshake-dev Firebase hosts (devo config baked in)." >&2
    exit 1
  fi
  if ! dist_has "$dir" firmshake-prod.firebaseapp.com; then
    echo "ERROR: Refusing prod — $dir missing firmshake-prod.firebaseapp.com." >&2
    exit 1
  fi
  if dist_has "$dir" firmshake-api-staging || dist_has "$dir" REPLACE-ME-firmshake-api || dist_has "$dir" REPLACE_ME; then
    echo "ERROR: Refusing prod — $dir contains staging API URL or placeholder config." >&2
    echo "  Deploy prod API first, then set VITE_API_BASE_URL to the us-east1 Cloud Run URL." >&2
    exit 1
  fi
  # Payments disabled copy must be present (meetup gate); refuse accidental Stripe-soon marketing.
  if ! dist_has "$dir" "Deposit payment is unavailable"; then
    echo "ERROR: Refusing prod — $dir missing payments-disabled UX copy (paymentsFlag)." >&2
    exit 1
  fi
  if dist_has "$dir" "Stripe soon" || dist_has "$dir" "coming soon" || dist_has "$dir" "Coming soon"; then
    echo "ERROR: Refusing prod — $dir contains payment-soon marketing copy." >&2
    exit 1
  fi
  echo "OK: $dir looks like firmshake-prod (prod)."
}

read_env_value() {
  local file="$1"
  local key="$2"
  sed -n "s/^${key}=//p" "$file" | head -n1 | sed 's/[\"'\'']//g' | tr -d '\r'
}

assert_env_devo() {
  local file="${1:-.env.local}"
  if [[ ! -f "$file" ]]; then
    echo "ERROR: env file missing: $file" >&2
    exit 1
  fi
  local project_id api_url
  project_id="$(read_env_value "$file" VITE_FIREBASE_PROJECT_ID)"
  api_url="$(read_env_value "$file" VITE_API_BASE_URL)"
  if [[ "$project_id" != "firmshake-dev" ]]; then
    echo "ERROR: Refusing deovo env — VITE_FIREBASE_PROJECT_ID=${project_id:-<unset>} (expected firmshake-dev) in $file" >&2
    exit 1
  fi
  if [[ "$api_url" == *firmshake-prod* ]] || [[ "$api_url" == *REPLACE* ]]; then
    echo "ERROR: Refusing deovo env — VITE_API_BASE_URL looks like prod/placeholder: $api_url" >&2
    exit 1
  fi
  echo "OK: $file looks like deovo env (firmshake-dev)."
}

assert_env_prod() {
  local file="${1:-.env.production.local}"
  if [[ ! -f "$file" ]]; then
    echo "ERROR: env file missing: $file" >&2
    exit 1
  fi
  local project_id api_url payments
  project_id="$(read_env_value "$file" VITE_FIREBASE_PROJECT_ID)"
  api_url="$(read_env_value "$file" VITE_API_BASE_URL)"
  payments="$(read_env_value "$file" VITE_PAYMENTS_ENABLED)"
  if [[ "$project_id" != "firmshake-prod" ]]; then
    echo "ERROR: Refusing prod env — VITE_FIREBASE_PROJECT_ID=${project_id:-<unset>} (expected firmshake-prod) in $file" >&2
    exit 1
  fi
  if [[ -z "$api_url" || "$api_url" == *REPLACE* || "$api_url" == *firmshake-api-staging* || "$api_url" == *firmshake-dev* ]]; then
    echo "ERROR: Refusing prod env — VITE_API_BASE_URL must be the prod Cloud Run URL (got: ${api_url:-<unset>})." >&2
    echo "  Deploy: cd ../firmshake-api && bash scripts/deploy-prod.sh" >&2
    exit 1
  fi
  # Prod must explicitly disable payments — unset would fall back to mock UX default.
  if [[ "$payments" != "false" ]]; then
    echo "ERROR: Refusing prod env — VITE_PAYMENTS_ENABLED must be false (got: ${payments:-<unset>})." >&2
    echo "  Dual-stack ships without a payment processor; see docs/devo-prod-stacks.md." >&2
    exit 1
  fi
  echo "OK: $file looks like prod env (firmshake-prod)."
}

case "$STACK" in
  deovo|devo)
    assert_dist_devo "${TARGET:-dist}"
    ;;
  prod|production)
    assert_dist_prod "${TARGET:-dist}"
    ;;
  env-devo|env-deovo)
    assert_env_devo "${TARGET:-.env.local}"
    ;;
  env-prod)
    assert_env_prod "${TARGET:-.env.production.local}"
    ;;
  *)
    echo "Unknown stack mode: $STACK" >&2
    exit 2
    ;;
esac
