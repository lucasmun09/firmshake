# FirmShake E2E Tests (Cypress)

Web integration tests for the Ionic Vue + Firebase app. Specs are split by feature under `tests/e2e/specs/` so they can run in parallel (Cypress Dashboard, CI matrix, or manual sharding).

## Prerequisites

1. **Node 18+** and `npm install`
2. **`.env.local`** with Firebase config (see [docs/FIREBASE_SETUP.md](../docs/FIREBASE_SETUP.md))
3. **Dev server** on port 5173 (Cypress `baseUrl`)

Optional credentials (see [Environment variables](#environment-variables)):

- **`CYPRESS_TEST_EMAIL_MFA`** / **`CYPRESS_TEST_PASSWORD_MFA`** — MFA-enrolled account (recommended for authenticated specs)
- **`CYPRESS_TEST_EMAIL`** / **`CYPRESS_TEST_PASSWORD`** — fallback; specs detect MFA enrollment redirect
- **`CYPRESS_SUPER_ADMIN_EMAIL`** / **`CYPRESS_SUPER_ADMIN_PASSWORD`** — super-admin moderator specs
- **`CYPRESS_MODERATOR_CANDIDATE_EMAIL`** — existing user to grant moderator access

reCAPTCHA is stubbed via `cy.stubRecaptcha()` (intercepts `POST **/api/auth/verify-recaptcha`).

Listing upload specs stub the Flask API (`GET **/health`, `POST **/api/images`) so photos do not require a running API server.

## Quick start

Terminal 1 — start the app:

```bash
npm run dev
```

Terminal 2 — run tests:

```bash
# All specs
npm run test:e2e

# Interactive runner
npm run test:e2e:open

# Full suite (same as test:e2e; alias for CI)
npm run test:e2e:smoke
```

### Environment variables

Set in the shell or `.env` (Cypress reads `CYPRESS_*` prefixed vars):

| Variable | Purpose |
|----------|---------|
| `CYPRESS_TEST_EMAIL_MFA` | Primary test account (MFA enrolled) |
| `CYPRESS_TEST_PASSWORD_MFA` | Password for MFA account |
| `CYPRESS_TEST_EMAIL` | Fallback account (may hit `/mfa-enroll`) |
| `CYPRESS_TEST_PASSWORD` | Fallback password |
| `CYPRESS_SUPER_ADMIN_EMAIL` | Super-admin account for moderator specs |
| `CYPRESS_SUPER_ADMIN_PASSWORD` | Super-admin password |
| `CYPRESS_MODERATOR_CANDIDATE_EMAIL` | Target user for grant-moderator flow |
| `CYPRESS_BASE_URL` | Override dev server URL (default `http://localhost:5173`) |

Example:

```bash
export CYPRESS_TEST_EMAIL_MFA=e2e-test@firmshake.dev
export CYPRESS_TEST_PASSWORD_MFA='your-password'
npm run test:e2e
```

## Parallel execution

Each file under `tests/e2e/specs/` is independent and safe to shard:

```bash
# Manual two-way split
npx cypress run --spec "tests/e2e/specs/auth.*.cy.ts,tests/e2e/specs/browse.filter.cy.ts,tests/e2e/specs/listing.*.cy.ts,tests/e2e/specs/messages.cy.ts"
npx cypress run --spec "tests/e2e/specs/communities.cy.ts,tests/e2e/specs/selling.cy.ts,tests/e2e/specs/buying.cy.ts,tests/e2e/specs/meetups.cy.ts,tests/e2e/specs/profile.cy.ts,tests/e2e/specs/mfa.cy.ts"
```

**Cypress Dashboard** (recommended for CI):

```bash
npx cypress run --parallel --record --key "$CYPRESS_RECORD_KEY"
```

**GitHub Actions matrix** — assign spec globs per job, e.g. `spec: tests/e2e/specs/auth*.cy.ts`.

Config notes (`cypress.config.ts`):

- `numTestsKeptInMemory: 0` — lower RAM when running many specs
- `experimentalRunAllSpecs: true` — run all specs from Cypress open
- `retries.runMode: 1` — one retry on flake in CI

## Spec map

| Spec | Coverage |
|------|----------|
| `auth.smoke.cy.ts` | Public routes, login/register shells, auth guards |
| `auth.login.cy.ts` | Email login, session cache, invalid credentials, sign out |
| `auth.register.cy.ts` | Register form; Google OAuth skipped (needs emulator) |
| `browse.filter.cy.ts` | Search, categories, community segments |
| `listing.upload.cy.ts` | Sell form, auth guard, end-to-end create (stubbed image API) |
| `listing.detail.cy.ts` | Browse → detail, metadata, auth guards |
| `messages.cy.ts` | Inbox, empty state, send message, thread navigation |
| `communities.cy.ts` | Search, join, create community, moderator panel (super admin) |
| `selling.cy.ts` | Seller tab, empty state, seller threads |
| `buying.cy.ts` | Buyer tab, empty state, buyer threads |
| `meetups.cy.ts` | Auth guards, FirmShake UI on buyer threads |
| `profile.cy.ts` | Profile shortcuts, sign out |
| `mfa.cy.ts` | MFA page shells, enrolled-account bypass; SMS flows skipped |

### Skipped tests

| Test | Reason |
|------|--------|
| Google sign-in | OAuth popup/redirect — use Auth emulator or `cy.origin` |
| Email registration | Creates Firebase users + MFA enrollment — run manually with disposable email |
| SMS MFA enroll/challenge | Requires Firebase test phone numbers (documented below) |

Data-dependent tests (messages, buying/selling threads, meetups) log and pass when no seeded data exists.

## MFA / SMS

FirmShake requires phone MFA after login. For automated tests:

1. Enroll a dedicated test user once (manually or Firebase test phone)
2. Set `CYPRESS_TEST_EMAIL_MFA` / `CYPRESS_TEST_PASSWORD_MFA`
3. In Firebase Console → Authentication → Settings, add **test phone numbers** (e.g. `+1 650-555-3434` → code `123456`) for local MFA specs

Specs call `cy.skipIfMfaGate()` when the account lands on `/mfa-enroll`.

## Firebase emulators (future)

The repo currently targets **firmshake-dev** (live Firebase). For hermetic CI:

1. Add Auth + Firestore emulators to `firebase.json`
2. Point `.env.local` / `CYPRESS_*` at emulator hosts
3. Seed users/listings via `firebase-admin` scripts

Until then, use dedicated dev test accounts and avoid production.

## Custom commands

Defined in `tests/e2e/support/commands.ts`:

- `cy.stubRecaptcha()` — mock reCAPTCHA verification
- `cy.visitApp(path)` — visit and wait for `ion-app`
- `cy.loginByUi()` / `cy.loginBySession()` — email login with session cache
- `cy.loginSuperAdminBySession()` — super-admin session (moderator specs)
- `cy.skipIfMfaGate()` — skip test if MFA enrollment required

Helpers in `tests/e2e/support/helpers.ts`:

- `describeWithMfaAuth` / `describeWithAuth` / `describeWithSuperAdmin` — conditional suites
- `fillIonInput`, `selectIonOption` — Ionic form helpers
- `stubListingApi`, `attachListingPhoto` — listing upload with mocked API

## Fixtures

- `tests/e2e/fixtures/test-data.json` — sample listing/community strings
- `tests/e2e/fixtures/sample-listing.png` — 1×1 PNG for photo upload tests

## Unit tests

```bash
npm run test:unit -- --run
```

After the feature-folder reorganization, unit specs import from `@/features/...` and `@/common/...` paths.
