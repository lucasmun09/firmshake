# Devo / Prod dual-stack

FirmShake runs two fully separate stacks. Existing beta data stays on **devo**; **prod** is a clean slate. Custom domain traffic should eventually hit **prod only**.

### Focused runbooks

| Doc | Use when |
|---|---|
| [`remaining-human-checklist.md`](./remaining-human-checklist.md) | **Code-complete leftovers** — workflow scope, MFA Cypress secrets, prod cutover |
| [`marketplace-remaining-gaps.md`](./marketplace-remaining-gaps.md) | No-payments product surface checklist (Done) |
| [`marketplace-integration-gaps.md`](./marketplace-integration-gaps.md) | Residual test risk without MFA secrets |
| [`prod-cutover-runbook.md`](./prod-cutover-runbook.md) | Auth/OAuth/reCAPTCHA → API → web → DNS cutover |
| [`typesense-dual-stack.md`](./typesense-dual-stack.md) | Separate Typesense clusters / backfill |
| [`ci-promote-pipeline.md`](./ci-promote-pipeline.md) | GitHub Environments, soft gate, WIF TODO |
| API [`../firmshake-api/docs/dual-stack.md`](../../firmshake-api/docs/dual-stack.md) | Cloud Run env assert, CORS catalogs, payments 503 |
| [`prod-gcp-scaffold.md`](./prod-gcp-scaffold.md) | Known prod GCP inventory; why Terraform is deferred |
| [`dual-stack-modules.md`](./dual-stack-modules.md) | Web module map for parallel agents |

## What you need to do

### Why `firm-shake.com` and `firmshake-dev.web.app` show identical listings

**Root cause (A) — same Hosting site + same baked config.** Not shared Typesense, not a prod seed from deovo.

Live probe (2026-09-03): both hostnames served **byte-identical** JS (`main-*.js` MD5 matched) and the same `firebase-messaging-config.json`:

| Field | Value on both hostnames |
|---|---|
| `projectId` | `firmshake-dev` |
| `authDomain` | `firmshake-dev.firebaseapp.com` |
| API base | `https://firmshake-api-staging-858269838319.us-central1.run.app` |

The DEVO banner is **hostname-hidden** on `firm-shake.com` / `www` only (`isProdPublicHostname`) — cosmetic. Both still read the **same Firestore + staging API**.

`firmshake-prod.web.app` is still **404 / never deployed**. Prod Cloud Run is **not deployed**. Prod Firestore (us-east1) exists and is a **separate empty DB**.

**Fixing identical listings requires Hosting/DNS cutover to `firmshake-prod` after prod web + API are live — not UI filters.**

### Domain map (verified 2026-09-03)

| URL | Desired stack | Current reality |
|---|---|---|
| [https://firmshake-dev.web.app](https://firmshake-dev.web.app) | **Devo** | Live on `firmshake-dev` (beta data) |
| [https://firmshake-dev.firebaseapp.com](https://firmshake-dev.firebaseapp.com) | **Devo** | Same deovo Hosting site |
| [https://firm-shake.com](https://firm-shake.com) (apex) | **Prod** | Still on **`firmshake-dev` Hosting** — serves beta (identical build) |
| [https://www.firm-shake.com](https://www.firm-shake.com) | **Prod** | **Not** on Firebase Hosting → Firebase **“Site Not Found”** (404). DNS is Cloudflare-proxied |
| [https://firmshake-prod.web.app](https://firmshake-prod.web.app) | **Prod** | Hosting site exists, **never deployed** (404) |

**Recommendation:** Point **both** apex `firm-shake.com` and `www.firm-shake.com` at **firmshake-prod**. Pick one canonical (usually www → apex redirect, or apex → www) in Firebase Hosting / Cloudflare after both domains are connected.

**Do not half-cutover DNS** until prod web + API are deployed and verified on `firmshake-prod.web.app`. Beta data on `firmshake-dev` is left alone.

### Prod readiness (verified 2026-09-03)

| Resource | Status |
|---|---|
| GCP / Firebase project `firmshake-prod` | Exists |
| Firestore `(default)` us-east1 | Exists, **empty** (separate from deovo `nam5`) |
| Hosting site | Exists — **404 / never deployed** |
| Custom domains on prod Hosting | **None** |
| Artifact Registry `firmshake` (us-east1) | Exists |
| Storage `firmshake-prod-images` | Exists |
| Cloud Run `firmshake-api` (us-east1) | **Not deployed** (no services in project) |
| Local `.env.production.local` | SDK values present; **`VITE_API_BASE_URL` still `REPLACE-ME-*`** |
| Prod API `.cloudrun.env.prod.yaml` | Scaffolded — `RECAPTCHA_SITE_KEY` still `REPLACE_ME_*` |
| Typesense (both stacks) | **Not configured** in Cloud Run env (Firestore browse fallback on staging) |

**Verdict:** Prod is **empty-ready** (safe clean slate) but **not deploy-complete**. `npm run deploy:prod` and API `bash scripts/deploy-prod.sh` now **refuse** placeholders / cross-wired deovo values. Prepare env + API + web first; then cut domains.

### Numbered cutover checklist (human + agent)

Complete **in order**. Skip DNS/Hosting moves until steps 1–6 pass.

1. **Bootstrap / finish prod web env**
   ```bash
   npm run firebase:setup:prod
   # or edit .env.production.local — SDK may already be filled; API URL is still REPLACE-ME
   ```
2. **Prod Auth (Firebase Console → firmshake-prod)**
   - Enable Email/Password, Google, SMS MFA as needed.
   - **Authorized domains:** `localhost`, `firmshake-prod.web.app`, `firmshake-prod.firebaseapp.com`, `firm-shake.com`, `www.firm-shake.com`.
3. **Prod Google OAuth redirect URIs** (GCP project `firmshake-prod` → Credentials → Web client auto-created by Google Service):
   ```
   https://firmshake-prod.firebaseapp.com/__/auth/handler
   https://firmshake-prod.web.app/__/auth/handler
   https://firm-shake.com/__/auth/handler
   https://www.firm-shake.com/__/auth/handler
   ```
4. **Prod reCAPTCHA** — create Enterprise/site key for `firmshake-prod.web.app`, `firm-shake.com`, `www.firm-shake.com`; put key in `.cloudrun.env.prod.yaml` + `.env.production.local` (`VITE_RECAPTCHA_SITE_KEY`).
5. **Deploy prod API**
   ```bash
   cd ../firmshake-api && bash scripts/deploy-prod.sh
   ```
   Then set `VITE_API_BASE_URL` in `.env.production.local` (+ GitHub Environment `prod`) to the printed Cloud Run URL.
6. **Deploy prod web** (refuses `firmshake-dev` project id, staging API, and `REPLACE-ME` URLs):
   ```bash
   npm run deploy:prod
   ```
   Verify [https://firmshake-prod.web.app/tabs/home](https://firmshake-prod.web.app/tabs/home) — empty browse, no beta listings.
7. **Remove custom domain from deovo Hosting** (no data deleted)
   - [Firebase Console → firmshake-dev → Hosting](https://console.firebase.google.com/project/firmshake-dev/hosting)
   - Remove **`firm-shake.com`** (and `www` if present).
   - Wait until Firebase releases the domain.
8. **Add domains on prod Hosting**
   - [Firebase Console → firmshake-prod → Hosting](https://console.firebase.google.com/project/firmshake-prod/hosting)
   - **Add custom domain** → `firm-shake.com`, then `www.firm-shake.com` (or add one and redirect the other per Firebase wizard).
9. **Update Cloudflare DNS** to the records Firebase shows (often `A`/`AAAA` to Firebase IPs, or `CNAME` to `firmshake-prod.web.app`).
   - During verification, set records to **DNS only** (grey cloud); re-enable proxy after SSL is **Connected**.
10. **Post-cutover cleanup**
    - Staging API: remove `https://firm-shake.com` and `https://www.firm-shake.com` from `.cloudrun.env.yaml` `CORS_ORIGINS`, then:
      ```bash
      cd ../firmshake-api && bash scripts/deploy-staging.sh
      ```
    - Devo Auth / OAuth: optional cleanup — remove prod hostnames from **firmshake-dev** authorized domains + OAuth redirect URIs (keep `firmshake-dev.web.app` / `.firebaseapp.com`).
    - Prod API CORS already targets prod hosts (see `.cloudrun.env.prod.yaml`).
11. **CI promote (optional)** — fill GitHub Environment `prod` secrets; set repo variable `PROD_DEPLOY_ENABLED=true` on web + API repos.

### How to verify separation (after cutover)

1. Open `/firebase-messaging-config.json` on each hostname:
   - deovo → `"projectId":"firmshake-dev"`
   - apex/`www`/prod → `"projectId":"firmshake-prod"`
2. Browse on deovo still shows beta listings; prod/apex shows **empty** (or only prod-created listings).
3. Network → `POST /api/v1/browse/search` hits **staging** Cloud Run on deovo and **prod** Cloud Run (us-east1) on prod hosts.
4. DEVO banner visible only on `firmshake-dev.web.app` / `.firebaseapp.com`, never on apex.

### Deovo Auth / OAuth (while apex still on beta)

Until step 7 completes, apex still serves **firmshake-dev**, so the **deovo** OAuth client must keep transitional redirect URIs:

```
https://firmshake-dev.firebaseapp.com/__/auth/handler
https://firmshake-dev.web.app/__/auth/handler
https://firm-shake.com/__/auth/handler
https://www.firm-shake.com/__/auth/handler
```

After cutover, deovo only needs the first two. Full console steps: [`docs/google-sign-in-ux.md`](./google-sign-in-ux.md).

### Fix beta CORS (“Failed to fetch” on `.firebaseapp.com`)

Staging API must allow both Firebase Hosting hostnames. Live staging already allows:

```text
https://firmshake-dev.web.app,https://firmshake-dev.firebaseapp.com,https://firmshake-controlpanel.web.app,https://firm-shake.com,https://www.firm-shake.com,http://localhost:5173,http://localhost:5174,capacitor://localhost,ionic://localhost
```

Verify: open [https://firmshake-dev.firebaseapp.com/tabs/home](https://firmshake-dev.firebaseapp.com/tabs/home) → Network → browse/search returns **200** with matching `Access-Control-Allow-Origin`.

**Post-cutover staging CORS (copy/paste):**

```text
https://firmshake-dev.web.app,https://firmshake-dev.firebaseapp.com,https://firmshake-controlpanel.web.app,http://localhost:5173,http://localhost:5174,capacitor://localhost,ionic://localhost
```

**Prod CORS (copy/paste):**

```text
https://firm-shake.com,https://www.firm-shake.com,https://firmshake-prod.web.app,https://firmshake-prod.firebaseapp.com,capacitor://localhost,ionic://localhost
```

No web redeploy needed for CORS-only API changes.

### Understand where your data lives today

Custom domain **`firm-shake.com` is still wired to `firmshake-dev`**, not `firmshake-prod`. Beta URLs and apex all read/write the **same** test data. That is expected until Hosting/DNS cutover.


| URL | Firebase project | Firestore | API (today) | Your test data? |
|---|---|---|---|---|
| [https://firmshake-dev.web.app](https://firmshake-dev.web.app) | `firmshake-dev` | deovo DB | staging Cloud Run | **Yes** |
| [https://firmshake-dev.firebaseapp.com](https://firmshake-dev.firebaseapp.com) | `firmshake-dev` | same | staging | **Yes** |
| [https://firm-shake.com](https://firm-shake.com) | **`firmshake-dev`** (until cutover) | same | staging | **Yes** |
| [https://www.firm-shake.com](https://www.firm-shake.com) | **Not connected** | — | — | N/A (404) |
| [https://firmshake-prod.web.app](https://firmshake-prod.web.app) | `firmshake-prod` | **empty** | prod Cloud Run (when deployed) | **No** |


**You do not need to migrate or copy data for beta.** Keep generating test data on `firmshake-dev`. Prod starts fresh.

### Point beta at deovo + staging


| Where | Variables / setting |
|---|---|
| Local `.env.local` | `VITE_FIREBASE_PROJECT_ID=firmshake-dev`, staging `VITE_API_BASE_URL` |
| GitHub Environment **`devo`** | Same `VITE_FIREBASE_*` from firmshake-dev; staging API URL; `FIREBASE_SERVICE_ACCOUNT` for firmshake-dev |
| Staging API `.cloudrun.env.yaml` | `FIREBASE_PROJECT_ID=firmshake-dev`, CORS block above (keep prod domains until cutover) |


Until Hosting step 7, treat **`firm-shake.com` as beta/deovo**, not prod.

## Locked decisions


| Decision | Choice |
|---|---|
| Stacks | `firmshake-dev` (devo/beta) + `firmshake-prod` |
| Billing / org | Same billing account OK; separate GCP orgs fine |
| Data | No copy/migration of users or listings to prod |
| Typesense | Fully separate clusters/databases (no shared collections) |
| Payments / processor | **Out of scope this phase** — no live Stripe. Prod: `PAYMENTS_ENABLED=false`. Devo: mock deposits only (flag may be on; no real processor) |
| Region | Prod Firestore/Storage (and prefer Cloud Run) in **us-east1** |
| Control panel | Devo only — never point at prod |
| Branch | Mainline = `main` (web repo may still accept `master` briefly) |
| Promote | Merge to main → deploy deovo → integration tests → on pass deploy prod |
| Custom domains | Both `firm-shake.com` and `www.firm-shake.com` → **prod** after cutover |


## Environments


| Alias | Firebase project | Web hosting | API (Cloud Run) | Payments |
|---|---|---|---|---|
| **devo** | `firmshake-dev` | [https://firmshake-dev.web.app](https://firmshake-dev.web.app) | `firmshake-api-staging` (us-central1) | Mock deposits only (`PAYMENTS_ENABLED=true`, no Stripe keys) |
| **prod** | `firmshake-prod` | [https://firmshake-prod.web.app](https://firmshake-prod.web.app) until custom domain cutover; then `firm-shake.com` / `www` | `firmshake-api` in **us-east1** | **Disabled** — no processor (`PAYMENTS_ENABLED=false`) |


Firebase CLI aliases (`.firebaserc`): `default` / `devo` → `firmshake-dev`, `prod` → `firmshake-prod`.

Deovo Hosting deploy never attaches custom domains — `firebase deploy --only hosting --project deovo` updates the default site only. Domain attach/detach is Console + DNS.

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
npm run deploy:hosting:devo   # firmshake-dev (default daily path; Vite --mode devo)
npm run deploy:hosting:prod   # alias → deploy:prod
npm run deploy:prod           # prod: --mode production + firmshake-prod preflight + rules + hosting
npm run firebase:setup:prod   # bootstrap firmshake-prod SDK → .env.production.local
npm run deploy:hosting        # alias → deovo
npm run assert:stack:devo     # refuse dist with firmshake-prod hosts / placeholders
npm run assert:stack:prod     # refuse dist with firmshake-dev hosts / staging API
npm run check:prod-readiness  # dry-run: list ALL web+API blockers (no deploy, no secrets)
```

Deploy scripts call `scripts/assert-baked-stack.sh` before `firebase deploy`. CI runs the same assert after each build.

**Before first prod deploy:** run `npm run check:prod-readiness`. It collects every env blocker in one pass (web `VITE_API_BASE_URL`, API `RECAPTCHA_SITE_KEY`, payments, CORS, Stripe keys) instead of fail-fast deploy asserts.

**Local pitfall:** `vite build` defaults to mode `production` and loads `.env.production.local`
if present. After bootstrapping prod SDK locally, a plain `npm run build` + deploy to deovo
would bake **firmshake-prod** into **firmshake-dev** Hosting (missing DEVO banner +
`auth/configuration-not-found`). Always use `npm run deploy:hosting` / `build:devo`
(mode `devo`) for beta. Prod stays on `deploy:prod` (mode `production`).

Also: `firm-shake.com` currently points at the **same** firmshake-dev Hosting site as
`firmshake-dev.web.app`, so any deovo hosting deploy updates both hostnames. DEVO chrome
is hostname-denylisted on apex/`www` only — not a separate DNS deploy.

### API scripts (`firmshake-api`)

```bash
bash scripts/deploy-staging.sh   # deovo / staging (current)
bash scripts/deploy-devo.sh      # alias → deploy-staging.sh
bash scripts/deploy-prod.sh      # prod (us-east1) — needs filled .cloudrun.env.prod.yaml
```

## Env wiring

### Frontend (`VITE_*`)

Prod builds must use **prod** Firebase + API URLs — never reuse deovo project IDs.


| Variable | Devo | Prod |
|---|---|---|
| `VITE_FIREBASE_*` | firmshake-dev | firmshake-prod |
| `VITE_API_BASE_URL` | staging Cloud Run | prod Cloud Run |
| `VITE_PAYMENTS_ENABLED` | `true` / unset (mock deposit UX) | `false` (no processor) |
| Maps / reCAPTCHA | deovo keys + domains | prod keys + firm-shake.com domains |


Template: `.env.example` (local/devo) and `.env.production.example` (prod shape).

### API


| Variable | Devo | Prod |
|---|---|---|
| `FIREBASE_PROJECT_ID` | `firmshake-dev` | `firmshake-prod` |
| `GCS_BUCKET` | `firmshake-dev-images` | `firmshake-prod-images` |
| `TYPESENSE_HOST` / `TYPESENSE_API_KEY` | deovo cluster | **separate** prod cluster |
| `TYPESENSE_LISTINGS_COLLECTION` | e.g. `listings` | same name OK **only** on the other cluster |
| `PAYMENTS_ENABLED` | `true` (mock deposit path only) | `false` |
| `STRIPE_*` | **omit** — no processor this phase | **omit** |
| `CORS_ORIGINS` | deovo Hosting + control panel (+ prod domains **only until cutover**) | `firm-shake.com`, `www`, `firmshake-prod.web.app`, `firmshake-prod.firebaseapp.com`, Capacitor |


**CORS cutover:** Today deovo CORS still includes `firm-shake.com` / `www` because apex still serves deovo. After DNS/Hosting cutover, remove production domains from deovo CORS and redeploy staging. Do not put control-panel origins on prod.

## Typesense

- Each stack has its own Typesense host/API key (and ideally cluster).
- Seed/reindex **only** from that stack’s Firestore (`scripts/backfill_typesense_listings.py` with prod credentials against prod).
- Never point prod Cloud Run at the deovo Typesense host.

## Payments (out of scope this phase)

Full dual-stack / prod feature ships **without a payment processor**. Do not plan live Stripe in cutover or CI promote.

- Runtime flag: `PAYMENTS_ENABLED` (alias `STRIPE_PAYMENTS_ENABLED`) on the API; `VITE_PAYMENTS_ENABLED` on the web.
- **Prod:** always `false` — deposit endpoints 503; UI shows “Deposit payment unavailable”.
- **Devo:** flag may stay `true` so agreement flows can confirm deposits via the **mock** API path (no Stripe keys). That is not a real processor.
- Do **not** add Stripe test or live keys for this phase.

## Human checklist — `firmshake-prod` (project exists; finish wiring)

1. **SDK / env** — `npm run firebase:setup:prod` or copy `.env.production.example` → `.env.production.local` + GitHub Environment `prod` secrets.
2. **Auth** — Email/Password, Google, SMS MFA; authorized domains listed in cutover step 2.
3. **Storage** — `firmshake-prod-images` already exists; ensure Cloud Run SA can read/write.
4. **Cloud Run** — Artifact Registry ready; deploy with `.cloudrun.env.prod.yaml` (`PAYMENTS_ENABLED=false`, prod Firebase/GCS/Typesense/CORS/reCAPTCHA).
5. **Typesense** — New prod cluster; search-only key for Cloud Run; backfill from prod Firestore only.
6. **Prod web deploy** — `npm run deploy:prod` → verify [https://firmshake-prod.web.app](https://firmshake-prod.web.app) (empty browse).
7. **Custom domain** — Move apex (and add www) from firmshake-dev → firmshake-prod (steps 7–9 above).
8. **CORS cleanup** — Remove prod domains from deovo API `CORS_ORIGINS` after cutover; redeploy staging.
9. **CI promote** — GitHub Environments `devo` / `prod` secrets; set `PROD_DEPLOY_ENABLED=true` when ready.
10. **Control panel** — Leave on deovo only.
11. **Payments** — Leave disabled on prod; no Stripe keys. Devo mock deposits only if needed for agreement QA.

## GitHub secrets (Environments `devo` / `prod`)

### Web (`firmshake`)


| Secret | Devo | Prod |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | firmshake-dev SA JSON | firmshake-prod SA JSON |
| `VITE_FIREBASE_*` / `VITE_API_BASE_URL` / Maps / reCAPTCHA | deovo values | prod values |
| `VITE_PAYMENTS_ENABLED` | `true` (mock UX) | `false` |
| `CYPRESS_BASE_URL` | [https://firmshake-dev.web.app](https://firmshake-dev.web.app) | — |
| `CYPRESS_TEST_EMAIL_MFA` / `CYPRESS_TEST_PASSWORD_MFA` | optional | — |


### API (`firmshake-api`)


| Secret | Devo | Prod |
|---|---|---|
| `GCP_SA_KEY` | firmshake-dev deploy SA (TODO → WIF) | firmshake-prod deploy SA (TODO → WIF) |
| `API_BASE_URL` | staging Cloud Run URL | prod Cloud Run URL |


Repo variable (both repos): `PROD_DEPLOY_ENABLED=true` when ready to auto-promote.

## Out of scope (for now)

- Data migration / copy to prod
- Cloud Deploy
- Pointing control panel at prod
- Payment processor / live or test Stripe (deferred beyond this dual-stack phase)

## Implementable surface status (code/docs/tests)

| Area | Status |
|---|---|
| Stack identity modules (web `stackHosts` / `appStack`, API `stack_config`) | Shipped |
| Payments flag modules (web `paymentsFlag`, API `payments_flag`) — prod off | Shipped |
| Deploy asserts (`assert-baked-stack.sh`, `assert-cloudrun-env.sh`) | Shipped |
| Cross-repo prod readiness dry-run (`check-prod-readiness.sh`) | Shipped |
| CI soft gate `PROD_DEPLOY_ENABLED` (web + API workflows) | Shipped — leave **unset/false** |
| CORS catalogs + Cloud Run YAML lockstep tests | Shipped |
| Meetup UX gated when payments disabled (no “Stripe soon” copy) | Shipped |
| Stack-aware `/health` + `smoke-health.sh` (CI deovo smoke) | Shipped |
| Env preflight scripts (web + API, no deploy) | Shipped |
| Unit/integration tests for stack + payments-disabled | Shipped (see packages below) |
| Runbooks (cutover, Typesense, CI promote, GCP scaffold) | Shipped |

**Web tests:** `npm run test:unit:dual-stack`

**API tests:** `pytest tests/test_payments_enabled.py tests/test_stack_config.py tests/test_assert_cloudrun_env.py tests/test_check_prod_readiness.py tests/test_health_stack.py tests/test_smoke_health_script.py -q`

**Cypress (devo):** `tests/e2e/specs/stack.devo.cy.ts` (CI guest smoke after deovo deploy)

## Human-only leftovers (not automatable here)

| Item | Where |
|---|---|
| Prod Auth providers + authorized domains | Firebase Console → `firmshake-prod` — [`prod-cutover-runbook.md`](./prod-cutover-runbook.md) steps 2–3 |
| Prod Google OAuth redirect URIs | GCP Credentials — cutover step 3 |
| Prod reCAPTCHA site key | **Exact gate:** `firmshake-api/.cloudrun.env.prod.yaml` line `RECAPTCHA_SITE_KEY: 'REPLACE_ME_PROD_RECAPTCHA_SITE_KEY'` blocks `deploy-prod.sh` |
| Fill `VITE_API_BASE_URL` after first prod API deploy | **Exact gate:** `.env.production.local` `VITE_API_BASE_URL=https://REPLACE-ME-firmshake-api-XXXX.us-east1.run.app` blocks `deploy:prod` |
| Typesense prod cluster + keys + backfill | [`typesense-dual-stack.md`](./typesense-dual-stack.md) — optional for first deploy (Firestore fallback) |
| First manual `deploy-prod.sh` + `npm run deploy:prod` | Requires filled secrets — gate stays off until proven |
| DNS / Hosting custom domain cutover | Cutover steps 7–9 — **do not half-cutover** |
| GitHub Environment `prod` secrets + optional WIF | [`ci-promote-pipeline.md`](./ci-promote-pipeline.md) |
| Set `PROD_DEPLOY_ENABLED=true` | Only after manual prod deploy is proven |

Confirm blockers anytime: `npm run check:prod-readiness` (lists all at once).
