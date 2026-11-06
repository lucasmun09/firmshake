# Remaining human checklist (no-payments marketplace)

Code for the **no-payments** marketplace is complete on firmshake#1 / firmshake-api#1. Agents cannot finish the items below.

Payments / Stripe / escrow stay **out of scope** — do not enable live Stripe.

## What you need to do

### 1. GitHub Actions workflow install (both repos)

Agent tokens lack the `workflow` OAuth scope. Copy canonical YAML into live workflows:

```bash
# Web
cp docs/ci-workflows/deploy-web.yml .github/workflows/deploy-web.yml
# API (from firmshake-api)
cp docs/ci-workflows/deploy-api.yml .github/workflows/deploy-api.yml
```

Commit + push with a credential that has **`workflow`** scope. Verify Actions runs on the PR / default branch.

### 2. Cypress MFA secrets (authenticated e2e)

Add to local shell and/or GitHub Environment `devo`:

| Secret | Purpose |
|---|---|
| `CYPRESS_TEST_EMAIL_MFA` | MFA-enrolled test user email |
| `CYPRESS_TEST_PASSWORD_MFA` | Password for that user |
| SMS / MFA test path | Complete `marketplace.flow.cy.ts` instead of soft-skip |

Verify:

```bash
CYPRESS_BASE_URL=https://firmshake-dev.web.app \
  npm run test:e2e -- --spec tests/e2e/specs/marketplace.flow.cy.ts
```

Also smoke authenticated **inbox BFF** on deovo (`VITE_USE_BFF_INBOX=true` already baked for deovo).

### 3. Prod stack secrets + first cutover

Follow [`devo-prod-stacks.md`](./devo-prod-stacks.md) and [`prod-cutover-runbook.md`](./prod-cutover-runbook.md) in order:

1. Finish `.env.production.local` (`VITE_API_BASE_URL` still placeholder until API exists).
2. Firebase Auth on **firmshake-prod** — Email/Password, Google, SMS MFA; authorized domains for prod + `firm-shake.com` / `www`.
3. Google OAuth redirect URIs for prod hostnames.
4. Prod reCAPTCHA site key → `.cloudrun.env.prod.yaml` + `VITE_RECAPTCHA_SITE_KEY`.
5. Typesense (optional; Firestore browse fallback works without it).
6. Deploy prod API → set web `VITE_API_BASE_URL` → `npm run deploy:prod`.
7. Only then move custom domains off deovo Hosting onto **firmshake-prod**.
8. Optional: set `PROD_DEPLOY_ENABLED=true` + GitHub Environment `prod` secrets / WIF.

Leave `PROD_DEPLOY_ENABLED` unset until secrets and smoke on `firmshake-prod.web.app` pass.

### 4. Merge PRs when ready

- https://github.com/lucasmun09/firmshake/pull/1
- https://github.com/lucasmun09/firmshake-api/pull/1

Prefer merge (not squash) if you want to preserve dual-stack history; either is fine once CI is installed.

## How to verify (no secrets)

```bash
# Web
npm run test:unit -- --run tests/unit/integration

# API
cd ../firmshake-api && python -m pytest tests/test_marketplace_flow_no_payments.py -q
```

Guest soft smoke (no MFA):

```bash
CYPRESS_BASE_URL=https://firmshake-dev.web.app npx cypress run \
  --spec tests/e2e/specs/marketplace.soft-smoke.cy.ts
```

## When to redeploy

Human checklist / docs-only → no redeploy. Prod cutover steps above require their own deploys.
