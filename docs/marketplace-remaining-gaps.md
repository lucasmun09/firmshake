# Remaining gaps — full marketplace (no payments)

Honest checklist vs a shippable marketplace **without** a payment processor. Updated 2026-11-05.

Agent-store copy: Project store `docs/remaining-gaps.md`.

Payments / Stripe / escrow = **out of scope** (Phase 6+). Mock meetup deposits stay.

## Product surfaces

| Area | Status | Notes |
|---|---|---|
| Auth (email, Google, MFA, password reset link) | **Done** | Devo live; prod Auth domains human |
| Guest browse + landing / mobile promo | **Done** | |
| Browse BFF search / filters / map / summary | **Done** | Description full-text still TODO |
| Listing detail + photos | **Done** | |
| Create / edit listing + image upload | **Done** | API image routes wired |
| **Mark listing sold** | **Done** | Seller-only UI + Firestore/BFF `POST …/sold`; browse treats sold as unavailable |
| Delist / moderator remove | **Done** | Sets `removed` |
| Saved listings (local + Firestore sync) | **Done** | Rules deploy verify on deovo |
| Messaging / inbox / archive / block | **Done** | Thread modules split |
| Buying / Selling tabs | **Done** | Selling shows active only |
| Profile / settings / appearance / blocked | **Done** | |
| Communities join/create/moderate | **Done** | |
| Meetup propose / accept / en route (mock deposit) | **Done** | Real Stripe gated off |
| Push notifications (FCM) | **Done** | |
| Public seller profile page | Open | Detail shows name only |
| Share / copy listing link | Open | Nice-to-have |
| Listing report / abuse flag | Open | Mods can remove; no buyer report |
| Message image attachments | Open | Text only |

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
| Unit (browse, auth, dual-stack, saved, threads) | **Done** | Targeted suites green |
| Cypress smoke (auth, browse, listing, stack.devo) | Partial | Marketplace guest + MFA flow specs added; blocked/map/mark-sold e2e still thin |
| Broader integration tests | **Done** (Vitest) | `tests/unit/integration/marketplace*.spec.ts` + API `test_marketplace_flow_no_payments.py` — see `docs/marketplace-integration-gaps.md` |

## Priority queue

1. ~~Mark listing sold~~ **Done** this turn
2. Cypress mark-sold + blocked/map soft smoke; deepen MFA marketplace.flow when secrets present
3. Description full-text search when product wants it
4. Share listing link
5. Public seller profile (lightweight)
6. Buyer report listing
