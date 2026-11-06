# Marketplace integration gaps (no payments)

Honest leftover risk after adding modular Vitest + Cypress coverage for
**browse → detail → saved → messaging → sell** without a payment processor.

## What this turn covers

| Layer | Files | Strength |
|---|---|---|
| Vitest cross-feature contracts | `tests/unit/integration/marketplace*.spec.ts` | Can fail on pure contracts (summary strip, save cap/merge, thread/inbox ids, sell create/remove routing, full chain) |
| Cypress guest walls | `tests/e2e/specs/marketplace.guest.cy.ts` | Real browse→detail + auth redirects; needs live deovo/local with listings |
| Cypress authenticated chain | `tests/e2e/specs/marketplace.flow.cy.ts` | Real UI when `CYPRESS_TEST_EMAIL_MFA` / password set; skipped otherwise |
| Cypress soft smoke | `tests/e2e/specs/marketplace.soft-smoke.cy.ts` | Guest map + mark-sold hide + blocked redirect; MFA mark-sold confirm/cancel (no mutate), blocked page, block CTA, map |
| API Flask chain | `firmshake-api/tests/test_marketplace_flow_no_payments.py` | browse/summary → create → message → inbox read; asserts payment routes absent |

## Related product gaps closed

**Mark listing sold** (seller-only) is implemented: `routeMarkListingSold` / BFF `POST /api/v1/listings/:id/sold` / Listing detail CTA (`data-testid="mark-sold-button"`). Vitest covers it in `listingServiceRouter.spec.ts`, `moderationMarkSold.spec.ts`, and `marketplaceSellFlow.spec.ts`. Cypress soft-smoke covers guest hide + seller confirm/cancel without mutating.

**Blocked / map soft smoke** landed in the same Cypress file (guest auth wall + MFA empty/list state; map chrome when BFF browse offers Map).

## Remaining gaps (do not rubber-stamp)

1. **Live Firestore subscribe / rebuild** — `subscribeInboxThreads`, `rebuildThreadsForUser`, and remote saved hydrate against a real project are still manual / MFA e2e. Unit tests mock remotes.
2. **Authenticated e2e CI** — marketplace.flow + existing smoke specs skip without MFA test secrets in the agent/CI environment. Guest e2e still needs `CYPRESS_BASE_URL` (deovo or local) and a non-empty browse feed.
3. **Saved is guest-accessible by design** — `/tabs/savedlistings` uses `guestAccessible: true` (local bookmarks only). Guests are **not** redirected to login; cross-device sync still requires auth. Do not “fix” this into an auth wall without a product decision.
4. ~~**Saved sync race**~~ **Done** — local + remote soft-delete tombstones; LWW merge (`deletedAt` vs `savedAt`); see `docs/saved-listings-sync.md`.
5. **Own-listing messaging** — composer is hidden for the seller’s own listing; e2e “send message” soft-skips when the first browse card is owned by the test user.
6. ~~**Inbox BFF default-off**~~ **Devo on** — `VITE_USE_BFF_INBOX=true` via `.env.devo` + CI deovo job; cursor page accumulate + Vitest; prod stays false. Authenticated inbox smoke still manual / MFA e2e.
7. ~~**Thread pagination (Firestore)**~~ **Done** — Firestore path caps at `FIRESTORE_INBOX_THREAD_CAP` (300, BFF parity); BFF path still cursor-accumulates. ~~Enrich cache~~ **Done**.
8. **Sell photo upload + Typesense index lag** — create listing e2e stubs `/api/images`; browse visibility after create is eventually consistent and not asserted in the Vitest chain.
9. ~~**Block-list filtering on browse**~~ **Done** — Bearer forwarded on browse/summary+search; client `browseBlockFilter` for cache paint; `bustBrowseCachesForBlockedSeller` after block.
10. **Payments / deposits** — intentionally out of scope; API test only asserts payment-ish routes stay 404/405/501/503.
11. **Multi-device bookmark proof** — no automated two-session Cypress; tombstone unit/integration coverage is automated; device A/B manual still useful after hosting deploy.
12. **Deovo deploy lag** — guest e2e hits currently hosted deovo; brand-new client routes need `npm run deploy:hosting` before hosted Cypress can see them.

## How to verify

```bash
# Web — Vitest marketplace integration (always runnable)
npm run test:unit -- --run tests/unit/integration

# Web — guest marketplace e2e against deovo (no auth secrets)
CYPRESS_BASE_URL=https://firmshake-dev.web.app npx cypress run --spec tests/e2e/specs/marketplace.guest.cy.ts

# Web — soft smoke (map / blocked / mark-sold cancel; MFA specs skip without secrets)
CYPRESS_BASE_URL=https://firmshake-dev.web.app npx cypress run --spec tests/e2e/specs/marketplace.soft-smoke.cy.ts

# Web — authenticated chain (requires MFA test user secrets)
CYPRESS_BASE_URL=https://firmshake-dev.web.app npm run test:e2e -- --spec tests/e2e/specs/marketplace.flow.cy.ts

# API
cd ../firmshake-api && python -m pytest tests/test_marketplace_flow_no_payments.py -q
```

## When to redeploy

Saved tombstone client sync → `npm run deploy:hosting` (deovo) so devices pick up LWW hydrate.
Docs/tests-only edits → no redeploy. Leave `PROD_DEPLOY_ENABLED` unset.
