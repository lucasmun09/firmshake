# Devo / Prod dual-stack

FirmShake runs two fully separate stacks. Existing data stays on **devo/beta**; **prod** is a clean slate.

## What you need to do

### Fix beta CORS (“Failed to fetch” on browse/categories)

**Root cause:** The staging API (`firmshake-api-staging`) allows `firmshake-dev.web.app` but was missing `**https://firmshake-dev.firebaseapp.com`**. Firebase Hosting serves the same build on both hostnames; users who land on `.firebaseapp.com` hit CORS blocks on `/api/v1/browse/search` and `/api/v1/categories`.

1. Confirm `.cloudrun.env.yaml` in `firmshake-api` includes all deovo origins (copy/paste block below).
2. Redeploy staging API:
  ```bash
   cd ../firmshake-api && bash scripts/deploy-staging.sh
  ```
3. Verify: open [https://firmshake-dev.firebaseapp.com/tabs/home](https://firmshake-dev.firebaseapp.com/tabs/home) → Network tab → `POST .../browse/search` returns **200** with `Access-Control-Allow-Origin: https://firmshake-dev.firebaseapp.com`.

**Staging `CORS_ORIGINS` (deovo Cloud Run):**

```text
https://firmshake-dev.web.app,https://firmshake-dev.firebaseapp.com,https://firmshake-controlpanel.web.app,https://firm-shake.com,https://www.firm-shake.com,http://localhost:5173,http://localhost:5174,capacitor://localhost,ionic://localhost
```

No web redeploy needed for CORS-only API changes.

### Understand where your data lives today

**Root cause of “prod has all my test data”:** Custom domain `**firm-shake.com` is still wired to the `firmshake-dev` Firebase project**, not `firmshake-prod`. There is only one Firestore database in use today (`firmshake-dev`). Beta URLs and `firm-shake.com` all read/write the **same** test data — that is correct for beta; it is **not** a separate prod environment yet.


| URL                                                                            | Firebase project                    | Firestore         | API (today)                    | Your test data?      |
| ------------------------------------------------------------------------------ | ----------------------------------- | ----------------- | ------------------------------ | -------------------- |
| [https://firmshake-dev.web.app](https://firmshake-dev.web.app)                 | `firmshake-dev`                     | deovo DB          | staging Cloud Run              | **Yes**              |
| [https://firmshake-dev.firebaseapp.com](https://firmshake-dev.firebaseapp.com) | `firmshake-dev`                     | same deovo DB     | staging Cloud Run              | **Yes**              |
| [https://firm-shake.com](https://firm-shake.com) / www                         | `**firmshake-dev`** (until cutover) | same deovo DB     | staging Cloud Run              | **Yes**              |
| [https://firmshake-prod.web.app](https://firmshake-prod.web.app)               | `firmshake-prod`                    | **empty prod DB** | prod Cloud Run (when deployed) | **No** — clean slate |


**You do not need to migrate or copy data for beta.** Keep generating test data on `firmshake-dev`. When prod is ready, create `firmshake-prod` with an **empty** Firestore — prod starts fresh.

### Point beta at dev + staging (checklist)


| Where                            | Variables / setting                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Local `.env.local`               | `VITE_FIREBASE_PROJECT_ID=firmshake-dev`, `VITE_API_BASE_URL=https://firmshake-api-staging-858269838319.us-central1.run.app` |
| GitHub Environment `**devo`**    | Same `VITE_FIREBASE_*` from firmshake-dev console; staging API URL; `FIREBASE_SERVICE_ACCOUNT` for firmshake-dev             |
| Staging API `.cloudrun.env.yaml` | `FIREBASE_PROJECT_ID=firmshake-dev`, deovo Typesense keys (when set), CORS block above                                       |


### Separate prod (when ready — no rush)

**Current state (verified):**


| Resource         | `firmshake-dev` (beta)                  | `firmshake-prod` (prod)                             |
| ---------------- | --------------------------------------- | --------------------------------------------------- |
| Firebase project | Exists                                  | **Exists**                                          |
| Firestore        | Test data (hundreds of listings)        | **Empty** (separate DB, us-east1)                   |
| Hosting site     | `firmshake-dev.web.app` — deployed      | `firmshake-prod.web.app` — **404 (never deployed)** |
| Custom domain    | `**firm-shake.com` / `www` still here** | Not connected yet                                   |
| Cloud Run API    | `firmshake-api-staging` (us-central1)   | **Not deployed** (us-east1 scaffold only)           |


Prod separation is **configured in code/CI** but **not live** until you deploy prod web/API and move the custom domain.

1. Run prod bootstrap (if SDK env not written yet): `npm run firebase:setup:prod` → `.env.production.local`
2. Fill GitHub Environment `**prod`** secrets from `.env.production.example` (mirror `.env.production.local`).
3. Deploy prod API: `cd ../firmshake-api && bash scripts/deploy-prod.sh` — set `FIREBASE_PROJECT_ID=firmshake-prod`, prod Typesense, prod reCAPTCHA in `.cloudrun.env.prod.yaml`.
4. Set `VITE_API_BASE_URL` in `.env.production.local` + GitHub `prod` secrets to the prod Cloud Run URL.
5. Deploy prod web: `npm run deploy:prod` (builds with `--mode production`, refuses `firmshake-dev` project id).
6. **Custom domain cutover** — move `firm-shake.com` / `www` from dev → prod (see below).
7. Remove `firm-shake.com` / `www` from **deovo** `CORS_ORIGINS` after cutover (keep them on prod API only).
8. Set repo variable `PROD_DEPLOY_ENABLED=true` on both repos to enable CI promote.

Until step 6, treat `**firm-shake.com` as beta/deovo**, not prod.

### Custom domain cutover (`firm-shake.com` → `firmshake-prod`)

Use **separate Firebase projects** (not multi-site within one project). Beta stays on `firmshake-dev`; prod gets the custom domain on `firmshake-prod`.

**Why separate projects works:** Each Firebase project has its own Hosting site, Firestore, and Auth. Moving the custom domain disconnects it from dev Hosting and attaches it to prod Hosting — DNS targets change from dev to prod Firebase records.

#### Before cutover

1. Deploy prod web to `https://firmshake-prod.web.app` and verify empty browse (no test listings).
2. Deploy prod API; confirm `GET {prod-api}/health` returns 200.
3. Prod Auth: authorized domains include `firmshake-prod.web.app`, `firm-shake.com`, `www.firm-shake.com`.
4. Prod Google OAuth redirect URIs include `https://firm-shake.com/__/auth/handler` and `https://www.firm-shake.com/__/auth/handler` on the **firmshake-prod** OAuth client.

#### Remove domain from beta (firmshake-dev)

1. [Firebase Console → firmshake-dev → Hosting](https://console.firebase.google.com/project/firmshake-dev/hosting)
2. Open the **firmshake-dev** site → **Domains** (or **Add custom domain** view → manage existing).
3. Remove `**firm-shake.com`** and `**www.firm-shake.com**` from this project.
4. Wait for Firebase to release the domain (can take a few minutes). Beta continues at `firmshake-dev.web.app` / `firmshake-dev.firebaseapp.com` — **no data is deleted**.

#### Add domain to prod (firmshake-prod)

1. [Firebase Console → firmshake-prod → Hosting](https://console.firebase.google.com/project/firmshake-prod/hosting)
2. **Add custom domain** → enter `firm-shake.com` → follow wizard.
3. Repeat for `www.firm-shake.com` (or set up redirect per Firebase guidance).
4. Firebase shows **DNS records** (typically `A`/`AAAA` to Firebase IPs or `CNAME` to `firmshake-prod.web.app`). Update at your DNS registrar (Cloudflare, etc.).
5. Wait for SSL provisioning (often 15–60 minutes; up to 24h).

#### Verify after cutover


| Check                                                                              | Expected                                                                |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [https://firm-shake.com/tabs/home](https://firm-shake.com/tabs/home)               | Empty browse, `VITE_FIREBASE_PROJECT_ID=firmshake-prod` in built assets |
| [https://firmshake-dev.web.app/tabs/home](https://firmshake-dev.web.app/tabs/home) | Still shows beta test data                                              |
| Network → `POST .../browse/search` on firm-shake.com                               | Prod Cloud Run URL, 200                                                 |
| Sign-in on firm-shake.com                                                          | Auth against firmshake-prod (separate user pool)                        |


#### DNS note (Cloudflare)

If DNS is proxied (orange cloud), Firebase custom-domain verification may require **DNS only** (grey cloud) during setup, then re-enable proxy after SSL is active — follow Firebase Console status messages.

## Locked decisions


| Decision      | Choice                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| Stacks        | `firmshake-dev` (devo/beta) + `firmshake-prod`                          |
| Billing / org | Same billing account OK; separate GCP orgs fine                         |
| Data          | No copy/migration of users or listings to prod                          |
| Typesense     | Fully separate clusters/databases (no shared collections)               |
| Stripe        | Devo = test keys; prod = **payments disabled** until explicitly enabled |
| Region        | Prod Firestore/Storage (and prefer Cloud Run) in **us-east1**           |
| Control panel | Devo only — never point at prod                                         |
| Branch        | Mainline = `main` (web repo may still accept `master` briefly)          |
| Promote       | Merge to main → deploy deovo → integration tests → on pass deploy prod  |


## Environments


| Alias    | Firebase project | Web hosting                                                                                    | API (Cloud Run)                             | Payments                                |
| -------- | ---------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------- |
| **devo** | `firmshake-dev`  | [https://firmshake-dev.web.app](https://firmshake-dev.web.app)                                 | `firmshake-api-staging` (us-central1 today) | Enabled (Stripe test / mock)            |
| **prod** | `firmshake-prod` | [https://firmshake-prod.web.app](https://firmshake-prod.web.app) (until custom domain cutover) | `firmshake-api` in **us-east1**             | **Disabled** (`PAYMENTS_ENABLED=false`) |


Firebase CLI aliases (`.firebaserc`): `default` / `devo` → `firmshake-dev`, `prod` → `firmshake-prod`.

## Promote pipeline

```text
push/merge to main
        │
        ▼
  Deploy web + API → deovo
        │
        ▼
  Integration tests against deovo
  (Cypress smoke; guest suite required, MFA optional via secrets)
        │
        ▼ (green only)
  Deploy web + API → prod
```

- GitHub Environments: `devo` and `prod` with **separate** secrets (see checklists below).
- Prefer Workload Identity Federation for GCP auth; SA JSON is transitional — leave a TODO in workflows until WIF is wired.
- Do **not** promote on failed or skipped required tests.
- **Soft gate:** automatic prod deploy runs only when repository variable `PROD_DEPLOY_ENABLED=true` (both web and API repos). Leave unset until `firmshake-prod` and Environment `prod` secrets exist so deovo CI keeps shipping.

### Web scripts

```bash
npm run deploy:hosting:devo   # firmshake-dev (default daily path)
npm run deploy:hosting:prod   # alias → deploy:prod
npm run deploy:prod           # prod: --mode production + firmshake-prod preflight + rules + hosting
npm run firebase:setup:prod   # bootstrap firmshake-prod SDK → .env.production.local
npm run deploy:hosting        # alias → deovo
```

### API scripts (`firmshake-api`)

```bash
bash scripts/deploy-staging.sh   # deovo / staging (current)
bash scripts/deploy-devo.sh      # alias → deploy-staging.sh
bash scripts/deploy-prod.sh      # prod scaffold (us-east1) — needs firmshake-prod + Artifact Registry
```

## Env wiring

### Frontend (`VITE_*`)

Prod builds must use **prod** Firebase + API URLs — never reuse deovo project IDs.


| Variable                | Devo                 | Prod                               |
| ----------------------- | -------------------- | ---------------------------------- |
| `VITE_FIREBASE_*`       | firmshake-dev        | firmshake-prod                     |
| `VITE_API_BASE_URL`     | staging Cloud Run    | prod Cloud Run                     |
| `VITE_PAYMENTS_ENABLED` | `true` / unset       | `false`                            |
| Maps / reCAPTCHA        | deovo keys + domains | prod keys + firm-shake.com domains |


Template: `.env.example` (local/devo) and `.env.production.example` (prod shape).

### API


| Variable                               | Devo                                                                                                                   | Prod                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `FIREBASE_PROJECT_ID`                  | `firmshake-dev`                                                                                                        | `firmshake-prod`                                             |
| `GCS_BUCKET`                           | `firmshake-dev-images`                                                                                                 | prod bucket (e.g. `firmshake-prod-images`)                   |
| `TYPESENSE_HOST` / `TYPESENSE_API_KEY` | deovo cluster                                                                                                          | **separate** prod cluster                                    |
| `TYPESENSE_LISTINGS_COLLECTION`        | e.g. `listings`                                                                                                        | same name OK **only** on the other cluster                   |
| `PAYMENTS_ENABLED`                     | unset / `true`                                                                                                         | `false`                                                      |
| `STRIPE_*`                             | test keys optional                                                                                                     | omit while payments disabled                                 |
| `CORS_ORIGINS`                         | `firmshake-dev.web.app`, `**firmshake-dev.firebaseapp.com`**, control panel, `firm-shake.com` (+ localhost, Capacitor) | `firm-shake.com`, `www`, `firmshake-prod.web.app`, Capacitor |


**Deovo CORS copy/paste:**

```text
https://firmshake-dev.web.app,https://firmshake-dev.firebaseapp.com,https://firmshake-controlpanel.web.app,https://firm-shake.com,https://www.firm-shake.com,http://localhost:5173,http://localhost:5174,capacitor://localhost,ionic://localhost
```

**CORS cutover:** Today deovo CORS still includes `firm-shake.com` because custom domain traffic may still hit deovo. After DNS/Hosting cutover to prod, remove production domains from deovo CORS. Do not put control-panel origins on prod.

## Typesense

- Each stack has its own Typesense host/API key (and ideally cluster).
- Seed/reindex **only** from that stack’s Firestore (`scripts/backfill_typesense_listings.py` with prod credentials against prod).
- Never point prod Cloud Run at the deovo Typesense host.

## Payments

- Runtime flag: `PAYMENTS_ENABLED` (alias `STRIPE_PAYMENTS_ENABLED`) on the API; `VITE_PAYMENTS_ENABLED` on the web.
- When disabled: deposit checkout and mock auto-confirm are rejected (503); UI hides pay CTAs.
- Prod default: disabled. Devo: enabled. Do not enable Stripe live keys on prod until product sign-off.

## Human checklist — `firmshake-prod` (project exists; finish wiring)

The GCP project `**firmshake-prod` already exists** with empty Firestore and a Hosting site. Complete:

1. **SDK / env** — `npm run firebase:setup:prod` or copy `.env.production.example` → `.env.production.local` + GitHub Environment `prod` secrets.
2. **Auth** — Email/Password, Google, SMS MFA; authorized domains: `firmshake-prod.web.app`, `firm-shake.com`, `www.firm-shake.com`, `localhost`.
3. **Storage** — Private images bucket (e.g. `firmshake-prod-images`) + service account access for Cloud Run.
4. **Cloud Run** — Artifact Registry + service `firmshake-api` in **us-east1**; deploy with `.cloudrun.env.prod.yaml` (`PAYMENTS_ENABLED=false`, prod Firebase/GCS/Typesense/CORS).
5. **Typesense** — New prod cluster; search-only key for Cloud Run; backfill from prod Firestore only.
6. **Prod web deploy** — `npm run deploy:prod` → verify [https://firmshake-prod.web.app](https://firmshake-prod.web.app) (empty browse).
7. **Custom domain** — Move `firm-shake.com` / `www` from firmshake-dev Hosting to firmshake-prod (see **Custom domain cutover** above).
8. **CORS cleanup** — Remove prod domains from deovo API `CORS_ORIGINS` after cutover.
9. **CI promote** — GitHub Environments `devo` / `prod` secrets; set `PROD_DEPLOY_ENABLED=true` on both repos when ready.
10. **Control panel** — Leave on deovo only.
11. **Stripe** — Do **not** add live keys; keep payments disabled until ready.

## GitHub secrets (Environments `devo` / `prod`)

### Web (`firmshake`)


| Secret                                                     | Devo                                                           | Prod                   |
| ---------------------------------------------------------- | -------------------------------------------------------------- | ---------------------- |
| `FIREBASE_SERVICE_ACCOUNT`                                 | firmshake-dev SA JSON                                          | firmshake-prod SA JSON |
| `VITE_FIREBASE_`* / `VITE_API_BASE_URL` / Maps / reCAPTCHA | deovo values                                                   | prod values            |
| `VITE_PAYMENTS_ENABLED`                                    | `true`                                                         | `false`                |
| `CYPRESS_BASE_URL`                                         | [https://firmshake-dev.web.app](https://firmshake-dev.web.app) | —                      |
| `CYPRESS_TEST_EMAIL_MFA` / `CYPRESS_TEST_PASSWORD_MFA`     | optional                                                       | —                      |


### API (`firmshake-api`)


| Secret         | Devo                                 | Prod                                  |
| -------------- | ------------------------------------ | ------------------------------------- |
| `GCP_SA_KEY`   | firmshake-dev deploy SA (TODO → WIF) | firmshake-prod deploy SA (TODO → WIF) |
| `API_BASE_URL` | staging Cloud Run URL                | prod Cloud Run URL                    |


Repo variable (both repos): `PROD_DEPLOY_ENABLED=true` when ready to auto-promote.

## Out of scope (for now)

- Data migration / copy to prod
- Cloud Deploy
- Pointing control panel at prod
- Enabling live Stripe on prod

