# Dual-stack module map (web)

Parallel-agent friendly split for deovo/prod work. Parent overview: [`devo-prod-stacks.md`](./devo-prod-stacks.md).

## What you need to do

Nothing console-side for this doc — use it when editing stack code so agents do not collide.

## Module map

| Concern | File |
|---|---|
| Host / project ID constants | `src/common/config/stackHosts.ts` |
| Stack resolve + DEVO debug UI gates | `src/common/config/appStack.ts` |
| Payments enabled flag + disabled copy | `src/common/config/paymentsFlag.ts` |
| Other BFF feature flags (re-exports payments) | `src/common/config/featureFlags.ts` |
| BFF auth header + error parse | `src/common/services/apiClient.ts` |
| BFF `/health` + `/ready` probes | `src/common/services/apiHealth.ts` |
| Health/ready JSON contract validators | `src/common/services/apiHealthContract.ts` |
| BFF barrel (domain calls + re-exports) | `src/common/services/api.ts` |
| Browse request body + endpoint fetch | `src/features/listings/services/browseSearchRequest.ts` |
| Browse full/search client | `src/features/listings/services/browseSearch.ts` |
| Browse summary client (local-first) | `src/features/listings/services/browseSearchSummary.ts` |
| Browse summary API contract | `docs/browse-summary-api.md` |
| Dist/env assert | `scripts/assert-baked-stack.sh` |
| Env preflight (no build) | `scripts/preflight-hosting.sh` (`npm run preflight:hosting:devo\|prod`) |
| Prod readiness checklist (cross-repo) | `scripts/check-prod-readiness.sh` (`npm run check:prod-readiness`) |
| Devo hosting deploy | `scripts/deploy-devo-hosting.sh` |
| Prod hosting deploy | `scripts/deploy-prod-hosting.sh` |
| CI promote | `docs/ci-workflows/deploy-web.yml` (copy into `.github/workflows/` with `workflow` scope) |

Meetup deposit CTAs read `isPaymentsEnabled()` / `PAYMENTS_DISABLED_USER_MESSAGE` from `paymentsFlag` (not featureFlags).

Browse local-first summary (non-payments): `docs/browse-summary-api.md` — client `browseSearchRequest.ts` + `browseSearchSummary.ts`; API `POST /api/v1/browse/summary`.

Messaging / inbox thread split (non-payments): `docs/messaging-threads-modules.md` — `threadModel.ts`, `threadSync.ts`, `threadRebuild.ts`, `threadSubscribe.ts`, barrel `threads.ts`.

Saved listings / bookmarks sync (non-payments): `docs/saved-listings-sync.md` — `savedListings.ts` (local), `savedListingsRemote.ts`, `savedListingsMerge.ts`, `savedListingsSync.ts`.

## Health / ready contract (lockstep with API)

`GET {API}/health` and `GET {API}/ready` return:

| Field | Devo | Prod |
|---|---|---|
| `status` | `ok` | `ok` |
| `service` | `firmshake-api` | `firmshake-api` |
| `stack` | `devo` | `prod` |
| `firebaseProjectId` | `firmshake-dev` | `firmshake-prod` |
| `paymentsEnabled` | `true` (mock only) | `false` |
| `ready` | only on `/ready` → `true` | only on `/ready` → `true` |

No secrets in either payload. Validators: `apiHealthContract.ts`. Cypress soft smoke: `tests/e2e/specs/stack.devo.cy.ts`.

## Tests

```bash
npm run test:unit:dual-stack
```

Includes `checkProdReadiness.spec.ts`, preflight coverage (`preflightHosting.spec.ts`), CORS catalog lockstep (`dualStackCorsCatalog.spec.ts`), health contract (`apiHealthContract.spec.ts` / `apiHealth.spec.ts`), and optional sibling-repo lockstep (`dualStackCrossRepo.spec.ts` — skips when `../firmshake-api` is absent).

Cypress stack smoke: `tests/e2e/specs/stack.devo.cy.ts` (included in CI after deovo deploy and in `test:e2e:smoke`).

## API sibling

`firmshake-api/docs/dual-stack.md` — `payments_flag.py`, `stack_config.py`, `health_payload.py`, browse_search split (`browse_search_*.py`), `assert-cloudrun-env.sh`, `smoke-health.sh` (health+ready), `preflight-api.sh`, `check-prod-readiness.sh`.
