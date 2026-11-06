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
| Dist/env assert | `scripts/assert-baked-stack.sh` |
| Env preflight (no build) | `scripts/preflight-hosting.sh` (`npm run preflight:hosting:devo\|prod`) |
| Prod readiness checklist (cross-repo) | `scripts/check-prod-readiness.sh` (`npm run check:prod-readiness`) |
| Devo hosting deploy | `scripts/deploy-devo-hosting.sh` |
| Prod hosting deploy | `scripts/deploy-prod-hosting.sh` |
| CI promote | `docs/ci-workflows/deploy-web.yml` (copy into `.github/workflows/` with `workflow` scope) |

Meetup deposit CTAs read `isPaymentsEnabled()` / `PAYMENTS_DISABLED_USER_MESSAGE` from `paymentsFlag` (not featureFlags).

## Tests

```bash
npm run test:unit:dual-stack
```

Includes `checkProdReadiness.spec.ts`, preflight coverage (`preflightHosting.spec.ts`), CORS catalog lockstep (`dualStackCorsCatalog.spec.ts`), and optional sibling-repo lockstep (`dualStackCrossRepo.spec.ts` — skips when `../firmshake-api` is absent).

Cypress stack smoke: `tests/e2e/specs/stack.devo.cy.ts` (included in CI after deovo deploy and in `test:e2e:smoke`).

## API sibling

`firmshake-api/docs/dual-stack.md` — `payments_flag.py`, `stack_config.py`, `health_payload.py`, `assert-cloudrun-env.sh`, `smoke-health.sh`, `preflight-api.sh`, `check-prod-readiness.sh`.
