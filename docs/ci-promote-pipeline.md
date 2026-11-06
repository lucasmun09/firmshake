# CI promote pipeline (devo → tests → prod)

Soft-gated promote for web + API. Prod auto-deploy runs only when repository variable `PROD_DEPLOY_ENABLED=true`. **Leave that gate off** until a manual prod deploy is proven.

Parent: [`devo-prod-stacks.md`](./devo-prod-stacks.md).


## Install CI workflows (requires `workflow` scope)

Agent HTTPS tokens cannot create `.github/workflows/*`. Canonical YAML lives in-repo:

```bash
mkdir -p .github/workflows
cp docs/ci-workflows/deploy-web.yml .github/workflows/deploy-web.yml
# optional incremental patch (already applied in the docs/ci-workflows copy):
# git apply docs/ci-deploy-web.workflow.patch
git add .github/workflows/deploy-web.yml
git commit -m "Install deploy-web workflow"
git push   # credential must include workflow scope
```

Leave repository variable `PROD_DEPLOY_ENABLED` **unset** until a manual prod deploy is proven.

Sibling API: `firmshake-api/docs/ci-workflows/deploy-api.yml`.


## Flow

```text
push/merge to main (web also accepts master briefly)
        │
        ▼
  Deploy web + API → deovo
        │
        ▼
  Integration / smoke against deovo
  (web: Cypress guest.routes; API: /health)
        │
        ▼ (green only + PROD_DEPLOY_ENABLED=true)
  Deploy web + API → prod
```

## What you need to do

### 1. GitHub Environments

Create Environments **`devo`** and **`prod`** on both `firmshake` and `firmshake-api`.

### 2. Web secrets (`firmshake`)

| Secret | Devo | Prod |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | firmshake-dev SA JSON | firmshake-prod SA JSON |
| `VITE_FIREBASE_*` / `VITE_API_BASE_URL` / Maps / reCAPTCHA | deovo | prod |
| `VITE_PAYMENTS_ENABLED` | `true` (mock deposits only) | `false` (no processor) |
| `CYPRESS_BASE_URL` | `https://firmshake-dev.web.app` | — |
| `CYPRESS_TEST_EMAIL_MFA` / `CYPRESS_TEST_PASSWORD_MFA` | optional | — |

### 3. API secrets (`firmshake-api`)

| Secret | Devo | Prod |
|---|---|---|
| `GCP_SA_KEY` | firmshake-dev deploy SA | firmshake-prod deploy SA |
| `API_BASE_URL` | staging Cloud Run URL | prod Cloud Run URL |

### 4. Soft gate (both repos)

- Repo **variable** `PROD_DEPLOY_ENABLED` — leave unset/`false` until ready.
- Set to `true` only after:
  1. Manual `bash scripts/deploy-prod.sh` succeeded once.
  2. Manual `npm run deploy:prod` succeeded once on `firmshake-prod.web.app`.
  3. Environment `prod` secrets are complete (no `REPLACE_ME`).

### 5. Workflow dispatch

Both workflows accept `target`: `full` | `devo` | `prod`.

- `devo` — deploy deovo only (no promote).
- `full` — deovo → tests → prod (if gate on).
- `prod` — prod only when gate on (use carefully).

## Workflow files

| Repo | File |
|---|---|
| Web | `.github/workflows/deploy-web.yml` |
| API | `.github/workflows/deploy-api.yml` |

Web builds deovo with Vite `--mode` via `npm run build:devo`, asserts dist with `scripts/assert-baked-stack.sh`, then deploys Hosting. Prod build uses mode `production` + payments default `false`.

API runs pytest → deploy staging → `scripts/smoke-health.sh` (asserts `stack=devo`, `firebaseProjectId=firmshake-dev`, `paymentsEnabled=true`) → soft-gated prod deploy with `.cloudrun.env.prod.yaml`.

## WIF TODO

Workflows still use SA JSON (`FIREBASE_SERVICE_ACCOUNT` / `GCP_SA_KEY`). Prefer Workload Identity Federation later:

1. Create GitHub OIDC provider in each GCP project.
2. Bind deploy SA with `roles/iam.workloadIdentityUser`.
3. Replace `credentials_json` / Firebase SA secret with `workload_identity_provider` + `service_account`.
4. Keep Environment separation (devo vs prod providers).

Until WIF lands, leave the `# TODO(wif)` comments in the workflows.

## How to verify

1. Push to `main` with gate **off** → deovo jobs run; prod job **skipped**.
2. Guest Cypress against `https://firmshake-dev.web.app` green (or skipped only if Cypress action fails for infra — do not skip required guest spec in CI config).
3. API smoke: `bash scripts/smoke-health.sh "$API_BASE_URL" deovo` (requires stack-aware `/health` payload).
4. With gate on (after manual prod proof): prod job runs and Hosting/Cloud Run update **firmshake-prod** only.

## When to redeploy

CI redeploys automatically on push when secrets exist. Local emergency: `npm run deploy:hosting:devo` / `bash scripts/deploy-staging.sh`. Never set the prod gate to unblock a broken deovo build.
