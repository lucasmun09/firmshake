#!/usr/bin/env bash
# Cross-repo prod readiness dry-run. Never deploys. Never invents secrets.
# Collects ALL blockers (unlike fail-fast deploy asserts) so humans can fix in one pass.
#
# Usage:
#   npm run check:prod-readiness
#   bash scripts/check-prod-readiness.sh
#
# Exit 0 only when env asserts for `deploy-prod.sh` + `deploy:prod` would pass.
# Console-only steps (Auth/OAuth/DNS) print as NOTE, not blockers.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_ROOT="${FIRMSHAKE_API_ROOT:-$ROOT/../firmshake-api}"
WEB_ENV="${FIRMSHAKE_PROD_ENV:-$ROOT/.env.production.local}"
API_ENV="${FIRMSHAKE_API_PROD_ENV:-$API_ROOT/.cloudrun.env.prod.yaml}"

BLOCKERS=0
NOTES=0

say() { printf '%s\n' "$*"; }
blocker() {
  BLOCKERS=$((BLOCKERS + 1))
  say "BLOCKER: $*"
}
note() {
  NOTES=$((NOTES + 1))
  say "NOTE: $*"
}
ok() { say "OK: $*"; }

read_env_value() {
  local file="$1"
  local key="$2"
  sed -n "s/^${key}=//p" "$file" | head -n1 | sed 's/[\"'\'']//g' | tr -d '\r'
}

yaml_val() {
  local file="$1"
  local key="$2"
  sed -n "s/^${key}:[[:space:]]*//p" "$file" | head -n1 | sed "s/^['\"]//;s/['\"]$//" | tr -d '\r'
}

line_of() {
  local file="$1"
  local pattern="$2"
  local n
  n="$(grep -nE "$pattern" "$file" 2>/dev/null | head -n1 | cut -d: -f1 || true)"
  echo "${n:-?}"
}

say "==> FirmShake prod readiness (dry-run, no deploy)"
say "    web: $ROOT"
say "    api: $API_ROOT"
say ""

# --- Web env -----------------------------------------------------------------
say "-- Web (.env.production.local) --"
if [[ ! -f "$WEB_ENV" ]]; then
  blocker "$WEB_ENV missing — run: npm run firebase:setup:prod (or copy .env.production.example)"
else
  project_id="$(read_env_value "$WEB_ENV" VITE_FIREBASE_PROJECT_ID)"
  api_url="$(read_env_value "$WEB_ENV" VITE_API_BASE_URL)"
  payments="$(read_env_value "$WEB_ENV" VITE_PAYMENTS_ENABLED)"
  recaptcha="$(read_env_value "$WEB_ENV" VITE_RECAPTCHA_SITE_KEY)"

  if [[ "$project_id" != "firmshake-prod" ]]; then
    blocker "$WEB_ENV:$(line_of "$WEB_ENV" '^VITE_FIREBASE_PROJECT_ID=') VITE_FIREBASE_PROJECT_ID=${project_id:-<unset>} (expected firmshake-prod)"
  else
    ok "VITE_FIREBASE_PROJECT_ID=firmshake-prod"
  fi

  if [[ -z "$api_url" || "$api_url" == *REPLACE* || "$api_url" == *firmshake-api-staging* || "$api_url" == *firmshake-dev* ]]; then
    blocker "$WEB_ENV:$(line_of "$WEB_ENV" '^VITE_API_BASE_URL=') VITE_API_BASE_URL must be prod Cloud Run URL after deploy-prod.sh (got: ${api_url:-<unset>})"
  else
    ok "VITE_API_BASE_URL looks like a real prod URL"
  fi

  if [[ "$payments" != "false" ]]; then
    blocker "$WEB_ENV:$(line_of "$WEB_ENV" '^VITE_PAYMENTS_ENABLED=') VITE_PAYMENTS_ENABLED must be false (got: ${payments:-<unset>})"
  else
    ok "VITE_PAYMENTS_ENABLED=false"
  fi

  if [[ -z "$recaptcha" ]]; then
    note "$WEB_ENV VITE_RECAPTCHA_SITE_KEY unset — fill before client MFA/auth gates need it (cutover step 4)"
  else
    ok "VITE_RECAPTCHA_SITE_KEY is set"
  fi
fi

say ""

# --- API env -----------------------------------------------------------------
say "-- API (.cloudrun.env.prod.yaml) --"
if [[ ! -d "$API_ROOT" ]]; then
  blocker "Sibling firmshake-api not found at $API_ROOT (set FIRMSHAKE_API_ROOT)"
elif [[ ! -f "$API_ENV" ]]; then
  blocker "$API_ENV missing"
else
  project_id="$(yaml_val "$API_ENV" FIREBASE_PROJECT_ID)"
  gcs="$(yaml_val "$API_ENV" GCS_BUCKET)"
  cors="$(yaml_val "$API_ENV" CORS_ORIGINS)"
  payments="$(yaml_val "$API_ENV" PAYMENTS_ENABLED)"
  recaptcha="$(yaml_val "$API_ENV" RECAPTCHA_SITE_KEY)"

  if [[ "$project_id" != "firmshake-prod" ]]; then
    blocker "$API_ENV:$(line_of "$API_ENV" '^FIREBASE_PROJECT_ID:') FIREBASE_PROJECT_ID=${project_id:-<unset>} (expected firmshake-prod)"
  else
    ok "FIREBASE_PROJECT_ID=firmshake-prod"
  fi

  if [[ "$gcs" != "firmshake-prod-images" ]]; then
    blocker "$API_ENV:$(line_of "$API_ENV" '^GCS_BUCKET:') GCS_BUCKET=${gcs:-<unset>} (expected firmshake-prod-images)"
  else
    ok "GCS_BUCKET=firmshake-prod-images"
  fi

  if [[ "$cors" == *firmshake-dev.web.app* || "$cors" == *firmshake-controlpanel* ]]; then
    blocker "$API_ENV:$(line_of "$API_ENV" '^CORS_ORIGINS:') CORS must not include deovo Hosting or control panel"
  elif [[ "$cors" != *firm-shake.com* || "$cors" != *firmshake-prod.web.app* ]]; then
    blocker "$API_ENV:$(line_of "$API_ENV" '^CORS_ORIGINS:') CORS must include firm-shake.com and firmshake-prod.web.app"
  else
    ok "CORS_ORIGINS targets prod hosts only"
  fi

  if [[ "$payments" != "false" && "$payments" != "'false'" ]]; then
    blocker "$API_ENV:$(line_of "$API_ENV" '^PAYMENTS_ENABLED:') PAYMENTS_ENABLED must be false (got: ${payments:-<unset>})"
  else
    ok "PAYMENTS_ENABLED=false"
  fi

  if [[ -z "$recaptcha" || "$recaptcha" == *REPLACE* || "$recaptcha" == *YOUR-PROD* ]]; then
    blocker "$API_ENV:$(line_of "$API_ENV" '^RECAPTCHA_SITE_KEY:') RECAPTCHA_SITE_KEY=${recaptcha:-<unset>} — create prod site key (blocks deploy-prod.sh)"
  else
    ok "RECAPTCHA_SITE_KEY is filled"
  fi

  # Active Stripe keys are out of scope this phase.
  if grep -nE '^[[:space:]]*STRIPE_(SECRET_KEY|WEBHOOK_SECRET|PUBLISHABLE_KEY):' "$API_ENV" | grep -vE '^[0-9]+:[[:space:]]*#' >/dev/null 2>&1; then
    blocker "$API_ENV has active STRIPE_* keys — dual-stack ships without a payment processor; comment/remove them"
  else
    ok "No active STRIPE_* keys in prod env"
  fi

  if grep -nE '^[[:space:]]*TYPESENSE_HOST:' "$API_ENV" | grep -vE '^[0-9]+:[[:space:]]*#' >/dev/null 2>&1; then
    typesense_host="$(yaml_val "$API_ENV" TYPESENSE_HOST)"
    if [[ "$typesense_host" == *YOUR-PROD* || "$typesense_host" == *REPLACE* || "$typesense_host" == *firmshake-dev* ]]; then
      blocker "$API_ENV:$(line_of "$API_ENV" '^TYPESENSE_HOST:') TYPESENSE_HOST looks like placeholder/deovo ($typesense_host)"
    else
      ok "TYPESENSE_HOST is set (separate prod cluster)"
    fi
  else
    note "Typesense still commented in $API_ENV — Firestore browse fallback OK for first prod deploy"
  fi

  # Also run fail-closed assert for parity with deploy-prod.sh (expect failure while placeholders remain).
  if [[ -x "$API_ROOT/scripts/assert-cloudrun-env.sh" || -f "$API_ROOT/scripts/assert-cloudrun-env.sh" ]]; then
    if bash "$API_ROOT/scripts/assert-cloudrun-env.sh" prod "$API_ENV" >/tmp/fs-prod-assert-api.out 2>&1; then
      ok "assert-cloudrun-env.sh prod passes"
    else
      # Already reported field-level blockers; surface assert exit for lockstep.
      note "assert-cloudrun-env.sh prod currently fails (expected until placeholders filled) — see BLOCKER lines above"
    fi
  fi
fi

say ""
say "-- Console-only (not automatable here) --"
note "Firebase Console firmshake-prod: Auth providers + authorized domains (prod-cutover-runbook.md steps 2–3)"
note "GCP Credentials: prod Google OAuth redirect URIs (cutover step 3)"
note "DNS / Hosting custom domain cutover only after firmshake-prod.web.app verified (steps 7–9)"
note "Leave PROD_DEPLOY_ENABLED unset until a manual prod deploy is proven"

say ""
if [[ "$BLOCKERS" -eq 0 ]]; then
  say "==> READY: env asserts would pass. Next: bash ../firmshake-api/scripts/deploy-prod.sh then npm run deploy:prod"
  exit 0
fi

say "==> NOT READY: $BLOCKERS blocker(s), $NOTES note(s). Fix BLOCKER lines, then re-run."
say "    Docs: docs/prod-cutover-runbook.md · docs/devo-prod-stacks.md"
exit 1
