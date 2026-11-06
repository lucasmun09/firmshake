# Remaining gaps — full marketplace (no payments)

Honest checklist vs a shippable marketplace **without** a payment processor. Updated 2026-11-05 (Firestore inbox thread cap parity).

Agent-store copy: Project store `docs/remaining-gaps.md`.

Payments / Stripe / escrow = **out of scope** (Phase 6+). Mock meetup deposits stay.

## Product surfaces

| Area | Status | Notes |
|---|---|---|
| Auth (email, Google, MFA, password reset link) | **Done** | Devo live; prod Auth domains human |
| Guest browse + landing / mobile promo | **Done** | |
| Browse BFF search / filters / map / summary | **Done** | |
| **Description full-text search** | **Done** | Typesense `query_by` title,sellerName,description (weights 4,2,1); Firestore + client ranking below title/seller |
| Listing detail + photos | **Done** | |
| Create / edit listing + image upload | **Done** | API image routes wired |
| **Mark listing sold** | **Done** | Seller-only UI + Firestore/BFF `POST …/sold`; browse treats sold as unavailable |
| Delist / moderator remove | **Done** | Sets `removed` |
| Saved listings (local + Firestore sync) | **Done** | Soft tombstones + LWW hydrate; rules deploy verify on deovo |
| Messaging / inbox / archive / block | **Done** | Thread modules split; inbox BFF on deovo (prod flag off) |
| Buying / Selling tabs | **Done** | Selling shows active only |
| Profile / settings / appearance / blocked | **Done** | |
| Communities join/create/moderate | **Done** | |
| Meetup propose / accept / en route (mock deposit) | **Done** | Real Stripe gated off |
| Push notifications (FCM) | **Done** | |
| **Public seller profile page** | **Done** | `/seller/:sellerId` + guest BFF `GET …/users/:uid/public` |
| **Share / copy listing link** | **Done** | Web Share API with clipboard fallback |
| **Listing report / abuse flag** | **Done** | Buyer `listingReports` + Firestore rules |
| **Message image attachments** | **Done** | `/api/images` upload; optional `imageUrl` on send (BFF + Firestore); `AuthenticatedImage` bubbles |

## Dual-stack / prod readiness

| Area | Status | Notes |
|---|---|---|
| Devo hosting + API staging | **Done** | Scripts + soft CI |
| Stack identity / health+ready / payments gate | **Done** | |
| Browse summary API + client prefer path | **Done** | |
| Live `.github/workflows/*` install | **Blocked** | Needs GitHub `workflow` scope; YAML under `docs/ci-workflows/` |
| Prod project secrets / reCAPTCHA / Typesense | **Blocked** | Human-only; `PROD_DEPLOY_ENABLED` unset |
| WIF / first prod cutover | **Blocked** | Runbook only |

## Test coverage

| Area | Status | Notes |
|---|---|---|
| Unit (browse, auth, dual-stack, saved+tombstones, threads, share, seller, report, message images, description search, browse block-list, thread enrich cache) | **Done** | Targeted suites green |
| Cypress smoke (auth, browse, listing, stack.devo) | **Done** (soft) | Soft smoke: share, seller, mark-sold, report cancel, map, blocked, attach photo |
| Broader integration tests | **Done** (Vitest) | `tests/unit/integration/marketplace*.spec.ts` (incl. inbox cap/BFF accumulate/enrich/block) + soft-smoke inbox + API `test_marketplace_flow_no_payments.py` cursor pages — see `docs/marketplace-integration-gaps.md` |

## Priority queue

1. ~~Mark listing sold~~ **Done**
2. ~~Cypress mark-sold + blocked/map soft smoke~~ **Done**
3. ~~Share listing link~~ **Done**
4. ~~Public seller profile (lightweight)~~ **Done**
5. ~~Buyer report listing~~ **Done**
6. ~~Message image attachments~~ **Done**
7. ~~Description full-text search~~ **Done**
8. ~~Saved sync tombstones~~ **Done**
9. ~~Inbox BFF deovo enable + cursor accumulate~~ **Done** (prod stays false; authenticated smoke still manual)
10. ~~Thread enrich cache~~ **Done** (`threadEnrichCache` TTL 60s; enrichThreads cache-first)
11. ~~Browse block-list Vitest~~ **Done** (Bearer forward + client filter + cache bust on block)
12. ~~Firestore inbox thread cap beyond first page~~ **Done** (`FIRESTORE_INBOX_THREAD_CAP` = 10×30; matches BFF accumulate)
13. Deepen MFA `marketplace.flow` when secrets present in CI
14. Cursor load-more UI if inboxes routinely exceed 300 (rare)
