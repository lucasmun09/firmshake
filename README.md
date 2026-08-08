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
| Payments (later) | Stripe | firmshake-api |

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

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Milestones](docs/MILESTONES.md)
- [Firebase setup](docs/FIREBASE_SETUP.md)

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
```

Runs Vitest (router guards, API health retries, guest auth UI, page titles, etc.). No dev server required.

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

The GitHub Actions workflow (`.github/workflows/deploy-web.yml`) builds and deploys only — it does **not** run Cypress today. Run integration tests locally before merging, or add a CI job with Firebase secrets + MFA test credentials.

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
| `settings.navigation.cy.ts` | partial | ✓ | Settings gear navigation, sub-page toolbar, auth redirect |
| `profile.cy.ts` | partial | ✓ | Settings shortcuts; auth guard |
| `messages.cy.ts` | — | ✓ | Inbox tab, threads, send message |
| `buying.cy.ts` | partial | ✓ | Buying tab; auth guard |
| `selling.cy.ts` | partial | ✓ | Selling tab; auth guard |
| `communities.cy.ts` | — | ✓ | Join, create, search communities |
| `meetups.cy.ts` | ✓ | ✓ | Meetup route guards; FirmShake section (auth) |

**Regression areas** covered by recent specs: desktop guest tab alerts (not login redirect), listing detail `document.title`, auth `?redirect=` preservation, settings navigation without internal errors, sell page `AppTopToolbar` + debounced backend health modal.

