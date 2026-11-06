# FirmShake

Community-first marketplace with binding in-person meetups, privacy-preserving proximity, and deposit-backed accountability.

**Ionic Vue + Capacitor** client for web, iOS, and Android.

The Flask API lives in a **separate repo**: [`firmshake-api`](../firmshake-api) (sibling directory).

## Stack

| Layer | Technology | Repo |
|---|---|---|
| Mobile + Web | Ionic Vue + Capacitor | **firmshake** (this repo) |
| Auth | Firebase Authentication | this repo |
| Database | Cloud Firestore | this repo |
| API + Images | Flask | **firmshake-api** |
| Deposits (this phase) | Mock on deovo; disabled on prod — no processor | firmshake-api |

**Environments:** deovo (`firmshake-dev`) and prod (`firmshake-prod`) — see [docs/devo-prod-stacks.md](docs/devo-prod-stacks.md), [prod cutover](docs/prod-cutover-runbook.md), [CI promote](docs/ci-promote-pipeline.md).

## Quick start

### 1. Firebase

Follow [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md), then:

```bash
cp .env.example .env.local
```

### 2. API server (separate repo)

```bash
cd ../firmshake-api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

API runs at `http://localhost:5001`.

### 3. Run the app

```bash
./start.sh
```

Or:

```bash
npm start
```

Web dev server: `http://localhost:5173`.

### 4. Mobile testing against local API

Phones cannot reach `localhost`. Tunnel the API and update `.env.local`:

```bash
# In firmshake-api directory
ngrok http 5001
```

```bash
# firmshake/.env.local
VITE_API_BASE_URL=https://your-tunnel.ngrok.io
```

## Current milestone focus

1. **Login** — Firebase Auth (email/password)
2. **Marketplace** — browse/create listings with placeholder + uploaded images
3. **API images** — upload via firmshake-api `POST /api/images`

See [docs/MILESTONES.md](docs/MILESTONES.md).

## Local-first browse architecture

Browse is optimized to **work from locally cached listing summaries** and prefetch ahead of the scroll position.

| Concern | Approach |
|---|---|
| **Cached shape** | `ListingSummary` (id, title, price, primary image, status, location when geo-active) — not full `Listing` documents |
| **Storage** | `sessionStorage` via `responseCache` (5 min) + `localStorage` browse pools (24 h, capped) |
| **Detail on demand** | Description, gallery, seller info load on listing detail / messages only |
| **Pagination** | Cursor-based pages (no session cap); lazy reveal at **75%** scroll; silent API prefetch at **55%** (max **2 pages ahead**); load-more spinner at **85%** when buffer is outrun |
| **Spinners** | Minimum **500ms** visible once shown (`useDebouncedVisibility`, `useMinimumDisplayVisibility`) |
| **API** | Today: `POST /api/v1/browse/search` with client-side summary strip. Phase 2: `POST /api/v1/browse/summary` (see `.cursor/rules/firmshake-local-first.mdc`) |

Key modules: `listingSummary.ts`, `browseLocalStorageCache.ts`, `browseSearchPrefetch.ts`, `HomePage.vue`.

## Geo compute & caching

Distance filtering and map pin clustering run on the **BFF** via a single `POST /api/v1/browse/search` call that always returns `listings` and seller-aggregated `pinGroups`. The client passes `pinGroups` to the map view and memoizes client-side aggregation only as a legacy fallback.

| Layer | TTL | Notes |
|---|---|---|
| BFF in-process search cache | **45s** per Cloud Run instance | Key: SHA-256 of search params + viewer UID; caches listings + pinGroups; header `X-Browse-Cache: HIT\|MISS` |
| Client pin aggregation memo | Until listing coords change | LRU 32 entries; fallback when `pinGroups` absent |
| sessionStorage browse search | 5 min | Summary listings + pinGroups (listingIds) |

See `.cursor/rules/firmshake-geo-caching.mdc` for bottleneck analysis and Redis/Memorystore path at multi-instance scale.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Milestones](docs/MILESTONES.md)
- [Firebase setup](docs/FIREBASE_SETUP.md)
- [Google Sign-In UX (in-page / GIS)](docs/google-sign-in-ux.md)

## Related repo

| Repo | Path | Purpose |
|---|---|---|
| **firmshake** | this repo | Ionic Vue client |
| **firmshake-api** | `../firmshake-api` | Flask API + image storage |

## Testing

Integration tests use **Cypress** against the Vite dev server. Unit tests use **Vitest**.

### Prerequisites

- **Node.js 20+** and `npm ci`
- **Firebase config** in `.env.local` (copy from `.env.example`)
- **Dev server** on port **5173** — Cypress `baseUrl` defaults to `http://localhost:5173`
- **Optional — MFA test account** for authenticated specs (see below)

### Unit tests

```bash
npm run test:unit
# Dual-stack / payments-disabled contracts only:
npm run test:unit:dual-stack
```

Runs Vitest (router guards, API health retries, guest auth UI, page titles, dual-stack, etc.). No dev server required.

### Integration / E2E tests

Start the app in one terminal:

```bash
npm start
# or: npm run dev
```

Run the smoke suite in another:

```bash
npm run test:integration
# alias for:
npm run test:e2e:smoke
```

Interactive mode:

```bash
npm run test:e2e:open
```

Run a single spec:

```bash
npx cypress run --spec tests/e2e/specs/guest.routes.cy.ts
```

#### Guest-only vs full suite

| Mode | Credentials | What runs |
|---|---|---|
| **Guest smoke** | None | Public routes, guest browse, auth guards, desktop guest tab alerts (~35 tests) |
| **Full smoke** | MFA account in `.env.local` | Above + authenticated tabs, sell flow, settings, messages (~80 tests) |

Specs use `describeWithMfaAuth` / `describeWithAuth`. When credentials are missing, those blocks are **skipped** (not failed).

#### MFA credentials (`.env.local`)

Add to `.env.local` (see commented keys in `.env.example`):

```bash
CYPRESS_TEST_EMAIL_MFA=your-mfa-enrolled@test.example
CYPRESS_TEST_PASSWORD_MFA=your-password
```

Optional fallbacks:

```bash
CYPRESS_TEST_EMAIL=
CYPRESS_TEST_PASSWORD=
```

Cypress loads `.env.local` automatically via `cypress.config.ts`. To hit deployed hosting instead of localhost:

```bash
CYPRESS_BASE_URL=https://firmshake-dev.web.app npm run test:integration
```

#### CI

GitHub Actions (`.github/workflows/deploy-web.yml`) on `main` / `master`:

1. Deploy hosting → **devo** (`firmshake-dev`)
2. Guest Cypress smoke against deovo
3. On green → deploy hosting → **prod** (`firmshake-prod`)

Requires GitHub Environments `devo` and `prod` with separate `VITE_*` / Firebase secrets. Prod cutover checklist: [docs/devo-prod-stacks.md](docs/devo-prod-stacks.md).

Local deploy:

```bash
npm run deploy:hosting:devo   # daily path (alias: npm run deploy:hosting); Vite --mode devo
npm run deploy:prod           # firmshake-prod — needs .env.production.local (see .env.production.example)
npm run firebase:setup:prod   # write prod SDK config to .env.production.local
# Note: plain `vite build` loads .env.production.local — never use it for firmshake-dev deploys.
```

```bash
CYPRESS_BASE_URL=https://firmshake-dev.web.app npm run test:integration
```

### Smoke spec coverage

| Spec | Guest | MFA | Covers |
|---|---|---|---|
| `auth.smoke.cy.ts` | ✓ | — | Root routing, login/register shells, `?redirect=` on protected routes |
| `guest.routes.cy.ts` | ✓ | — | Desktop guest tab alerts (Buying/Selling/Inbox), guest listing detail |
| `auth.login.cy.ts` | partial | ✓ | Email login, session persistence, sign out |
| `auth.register.cy.ts` | ✓ | — | Register form validation |
| `mfa.cy.ts` | ✓ | ✓ | MFA page shells; enrolled account bypasses enrollment |
| `browse.filter.cy.ts` | ✓ | ✓ | Guest browse; search, filters, communities (auth) |
| `listing.detail.cy.ts` | ✓ | ✓ | Guest listing detail + document title; auth edit guard |
| `listing.upload.cy.ts` | partial | ✓ | Sell toolbar, backend wait modal, create listing (stubbed API) |
| `settings.navigation.cy.ts` | partial | ✓ | Profile-menu Settings navigation, sub-page toolbar, auth redirect |
| `profile.cy.ts` | partial | ✓ | Settings shortcuts; auth guard |
| `messages.cy.ts` | — | ✓ | Inbox tab, threads, send message |
| `buying.cy.ts` | partial | ✓ | Buying tab; auth guard |
| `selling.cy.ts` | partial | ✓ | Selling tab; auth guard |
| `communities.cy.ts` | — | ✓ | Join, create, search communities |
| `meetups.cy.ts` | ✓ | ✓ | Meetup route guards; FirmShake section (auth) |

**Regression areas** covered by recent specs: desktop guest tab alerts (not login redirect), listing detail `document.title`, auth `?redirect=` preservation, settings navigation without internal errors, sell page `AppTopToolbar` + debounced backend health modal.

