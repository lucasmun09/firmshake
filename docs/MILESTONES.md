# FirmShake Milestones (Client)

API-specific milestones are tracked in **firmshake-api**.

## Phase 0 — Scaffold ✅

- [x] Ionic Vue + Capacitor app (this repo)
- [x] Flask API in separate **firmshake-api** repo
- [x] Project docs and env templates
- [ ] Firebase project created and config added to `.env.local`
- [ ] `ionic cap add ios` and `ionic cap add android`

## Phase 1 — Login (current)

**Goal:** User can sign in and reach a protected home screen.

| Task | Status |
|---|---|
| Create Firebase project | TODO |
| Enable Email/Password auth | TODO |
| Add Firebase SDK to Ionic app | TODO |
| Login + Register pages | Scaffolded |
| Auth route guard | Scaffolded |
| Create `users/{uid}` doc on first login | Scaffolded |

**Done when:** Sign up, sign in, sign out on web; unauthenticated users redirect to `/login`.

## Phase 2 — Basic marketplace

| Task | Status |
|---|---|
| Listing feed with mock data | Scaffolded |
| Community filter (ALL + specific) | Scaffolded |
| Listing detail page | Scaffolded |
| Create listing form | Scaffolded |
| Seed admin-curated communities in Firestore | TODO |
| Join/leave user communities | TODO |

## Phase 3 — API images

**Requires firmshake-api running.**

| Task | Status |
|---|---|
| Image picker in create-listing flow | Scaffolded |
| Upload to `POST /api/images` | Scaffolded |
| Display images from API URL | Scaffolded |
| Tunnel setup for mobile dev | TODO |

## Phase 4–7

See prior roadmap: communication → meetup/proximity → deposits → full payments.

---

## Immediate next steps

1. **Create Firebase project** — [FIREBASE_SETUP.md](FIREBASE_SETUP.md)
2. **Fill in `.env.local`** from `.env.example`
3. **Start API:** `cd ../firmshake-api && python app.py`
4. **Start app:** `npm run dev`
5. **Complete Phase 1** — verify login end-to-end with Firebase

## Related repo

| Repo | Milestones |
|---|---|
| **firmshake** | Client UI, Firebase, Firestore, Capacitor |
| **firmshake-api** | Images, location ETA, Stripe, admin endpoints |
