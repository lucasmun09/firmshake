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
| Listing feed with mock data | Firestore realtime |
| Community filter (ALL + specific) | Firestore |
| Listing detail page | Firestore |
| Create listing form | Firestore |
| Seed admin-curated communities in Firestore | Auto-seed on login |
| Join/leave user communities | Profile page |
| Create user communities | Profile page |

## Phase 3 — API images ✅

**Requires firmshake-api running.**

| Task | Status |
|---|---|
| Image picker in create-listing flow | Web file + native camera |
| Upload to `POST /api/images` | Wired with API health check |
| Display images from API URL | Wired |
| Tunnel setup for mobile dev | Documented in README |

## Phase 4 — Communication ✅

| Task | Status |
|---|---|
| Listing chat (Firestore messages) | Realtime on listing detail |
| Push notifications (FCM) | Done — web + native registration, API delivery |

## Phase 5 — Meetup + proximity (in progress)

| Task | Status |
|---|---|
| Google Sign-In | Done |
| Binding meetup proposal flow | Done |
| Seller accept / decline | Done |
| Deposit step (mock, pre-Stripe) | Done |
| En route + location polling | Done |
| Flask ETA calculation | firmshake-api `/api/meetups/{id}/location` |
| Privacy: ETA only to other party | Server-side Firestore updates |
| Stripe deposit collection | Phase 6 |

## Phase 6–7

Stripe deposits → full payments + no-show penalties.

---

## Immediate next steps

1. **API service account** — see firmshake-api README (`GOOGLE_APPLICATION_CREDENTIALS`)
2. **Start API:** `cd ../firmshake-api && source .venv/bin/activate && python app.py`
3. **Start app:** `npm run dev`
4. **Test meetup flow** — buyer starts meetup → MeetupPage → share location

## Related repo

| Repo | Milestones |
|---|---|
| **firmshake** | Client UI, Firebase, Firestore, Capacitor |
| **firmshake-api** | Images, location ETA, Stripe, admin endpoints |
