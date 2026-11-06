# Prod cutover runbook

Move custom domain traffic from **firmshake-dev** (beta) to **firmshake-prod** (clean slate). Do **not** copy data. Do **not** half-cutover DNS.

Parent overview: [`devo-prod-stacks.md`](./devo-prod-stacks.md). Typesense: [`typesense-dual-stack.md`](./typesense-dual-stack.md). CI: [`ci-promote-pipeline.md`](./ci-promote-pipeline.md).

## What you need to do

Complete **in order**. Skip Hosting/DNS moves until steps 1–6 pass on `firmshake-prod.web.app`.

0. **Dry-run blockers (optional but recommended)**
   ```bash
   npm run check:prod-readiness
   ```
   Lists every web + API env blocker in one pass (no deploy, no secrets). Re-run after each console fill.

1. **Finish prod web env**
   ```bash
   npm run firebase:setup:prod
   # or edit .env.production.local — VITE_API_BASE_URL still REPLACE-ME until API exists
   ```
   Confirm `VITE_FIREBASE_PROJECT_ID=firmshake-prod` and `VITE_PAYMENTS_ENABLED=false` (no payment processor this phase).

2. **Prod Auth (Firebase Console → firmshake-prod)**
   - Enable Email/Password, Google, SMS MFA as needed.
   - **Authorized domains:** `localhost`, `firmshake-prod.web.app`, `firmshake-prod.firebaseapp.com`, `firm-shake.com`, `www.firm-shake.com`.

3. **Prod Google OAuth redirect URIs** (GCP `firmshake-prod` → Credentials → Web client):
   ```
   https://firmshake-prod.firebaseapp.com/__/auth/handler
   https://firmshake-prod.web.app/__/auth/handler
   https://firm-shake.com/__/auth/handler
   https://www.firm-shake.com/__/auth/handler
   ```

4. **Prod reCAPTCHA** — create Enterprise/site key for `firmshake-prod.web.app`, `firm-shake.com`, `www.firm-shake.com`; put key in:
   - `firmshake-api/.cloudrun.env.prod.yaml` (`RECAPTCHA_SITE_KEY`)
   - `.env.production.local` (`VITE_RECAPTCHA_SITE_KEY`)
   - GitHub Environment `prod` secrets

5. **Deploy prod API** (us-east1; refuses placeholders):
   ```bash
   cd ../firmshake-api && bash scripts/deploy-prod.sh
   ```
   Copy the printed Cloud Run URL into web `.env.production.local` + GitHub Environment `prod` as `VITE_API_BASE_URL`.

6. **Deploy prod web** (refuses deovo/staging cross-wire):
   ```bash
   npm run deploy:prod
   ```
   Verify [https://firmshake-prod.web.app/tabs/home](https://firmshake-prod.web.app/tabs/home) — empty browse, no beta listings, no DEVO banner, deposit CTAs hidden.

7. **Remove custom domain from deovo Hosting** (no data deleted)
   - [Firebase Console → firmshake-dev → Hosting](https://console.firebase.google.com/project/firmshake-dev/hosting)
   - Remove **`firm-shake.com`** (and `www` if present).
   - Wait until Firebase releases the domain.

8. **Add domains on prod Hosting**
   - [Firebase Console → firmshake-prod → Hosting](https://console.firebase.google.com/project/firmshake-prod/hosting)
   - **Add custom domain** → `firm-shake.com`, then `www.firm-shake.com` (or add one and redirect the other).

9. **Update Cloudflare DNS** to the records Firebase shows.
   - During verification: **DNS only** (grey cloud); re-enable proxy after SSL is **Connected**.

10. **Post-cutover cleanup**
    - Staging API: remove `https://firm-shake.com` and `https://www.firm-shake.com` from `.cloudrun.env.yaml` `CORS_ORIGINS`, then:
      ```bash
      cd ../firmshake-api && bash scripts/deploy-staging.sh
      ```
    - Optional: remove prod hostnames from **firmshake-dev** Auth authorized domains + OAuth redirect URIs.
    - Prod API CORS already targets prod hosts only (no control panel).

11. **CI auto-promote (optional)** — fill GitHub Environment `prod` secrets; set repo variable `PROD_DEPLOY_ENABLED=true` on web + API **only after a manual prod deploy is proven**. Leave the gate off until then.

## How to verify

1. `/firebase-messaging-config.json` → deovo `projectId: firmshake-dev`; apex/www/prod `firmshake-prod`.
2. Browse: deovo still has beta listings; prod/apex empty (or only prod-created).
3. Network: deovo → staging Cloud Run; prod hosts → us-east1 Cloud Run.
4. DEVO banner only on `firmshake-dev.web.app` / `.firebaseapp.com`.
5. Deposit pay CTAs gated on prod (“Deposit payment unavailable”); API deposit endpoints return **503**. No Stripe keys in cutover.

## When to redeploy

| Change | Redeploy |
|---|---|
| Auth / OAuth console domains only | No web/API redeploy |
| `VITE_*` / Firebase messaging config | `npm run deploy:prod` (or deovo) |
| API `CORS_ORIGINS` / `PAYMENTS_ENABLED` / reCAPTCHA | API `deploy-staging.sh` or `deploy-prod.sh` |
| DNS only | No app redeploy |

## Rollback (domain only)

Re-attach `firm-shake.com` to **firmshake-dev** Hosting and restore Cloudflare records Firebase shows for deovo. Beta data on deovo is unchanged. Prod Cloud Run/Hosting can stay deployed unused.
