# Typesense dual-stack

Each FirmShake stack has its **own** Typesense cluster (or at least host + API key + dataset). Never point prod Cloud Run at the deovo Typesense host.

Parent: [`devo-prod-stacks.md`](./devo-prod-stacks.md).

## What you need to do

### Devo (firmshake-dev / staging API)

1. Create (or reuse) a Typesense Cloud / self-hosted cluster for **beta only**.
2. Create a **search-only** API key scoped to the listings collection.
3. Uncomment and fill in `firmshake-api/.cloudrun.env.yaml`:
   ```yaml
   TYPESENSE_HOST: 'https://YOUR-DEVO-TYPESENSE-HOST'
   TYPESENSE_API_KEY: 'YOUR-DEVO-SEARCH-ONLY-KEY'
   TYPESENSE_LISTINGS_COLLECTION: 'listings'
   ```
4. Redeploy staging:
   ```bash
   cd ../firmshake-api && bash scripts/deploy-staging.sh
   ```
5. Backfill from **deovo** Firestore only:
   ```bash
   # with deovo GOOGLE_APPLICATION_CREDENTIALS + FIREBASE_PROJECT_ID=firmshake-dev
   python scripts/backfill_typesense_listings.py
   ```
6. Verify: browse on [https://firmshake-dev.web.app](https://firmshake-dev.web.app) returns Typesense hits (`X-Browse-Engine` / logs), not empty Firestore fallback if you expect indexed data.

### Prod (firmshake-prod / us-east1)

1. Create a **separate** Typesense cluster (new account project or new cluster — do not reuse deovo host/keys).
2. Create a search-only key for the prod listings collection (same collection **name** is OK).
3. Fill `firmshake-api/.cloudrun.env.prod.yaml` (keep commented until ready; deploy assert allows commented `YOUR-PROD-` lines):
   ```yaml
   TYPESENSE_HOST: 'https://YOUR-PROD-TYPESENSE-HOST'
   TYPESENSE_API_KEY: 'YOUR-PROD-SEARCH-ONLY-KEY'
   TYPESENSE_LISTINGS_COLLECTION: 'listings'
   ```
4. Deploy prod API after other prod env fields (reCAPTCHA, etc.) are real:
   ```bash
   bash scripts/deploy-prod.sh
   ```
5. Backfill from **prod** Firestore only (empty until listings are created on prod).
6. Never run deovo backfill credentials against the prod Typesense host.

## Locked rules

| Rule | Detail |
|---|---|
| Separate datasets | Devo listings must not appear in prod search |
| Separate credentials | Distinct `TYPESENSE_HOST` + `TYPESENSE_API_KEY` per stack |
| Fallback | If Typesense unset, API uses Firestore browse fallback (current staging behavior) |
| Control panel | Unrelated — stays deovo-only |

## How to verify

1. Staging Cloud Run env shows deovo Typesense host only.
2. Prod Cloud Run env shows a different host (or Typesense unset → Firestore fallback on empty prod).
3. Creating a listing on deovo does **not** change prod browse results.

## When to redeploy

Typesense env changes → redeploy the matching API stack. Web hosting redeploy not required for search-engine-only changes.
