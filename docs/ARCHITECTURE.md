# FirmShake Architecture (Client)

This repo is the **Ionic Vue + Capacitor** client. The Flask API is in **[firmshake-api](../firmshake-api)**.

## Product principles

1. **Binding meetups** — buyer and seller agree on price, time, and place; both are accountable.
2. **Privacy-preserving proximity** — each party sees ETA and progress toward the meetup, never the other person's GPS.
3. **Deposit-backed trust** — $10 buyer deposit; no-show penalties enforced server-side.
4. **Community-first listings** — items are posted to communities (church, club, etc.) or **ALL** by default.

## Client: Ionic Vue + Capacitor

Single Vue 3 codebase targets:

- Web (Vite dev server / production build)
- iOS (Capacitor)
- Android (Capacitor)

### Key Capacitor plugins (later milestones)

| Plugin | Purpose |
|---|---|
| `@capacitor/geolocation` | Send location to firmshake-api during active meetup |
| `@capacitor/camera` | Listing photos |
| `@capacitor/push-notifications` | Meetup reminders via FCM |

## API server (separate repo)

**firmshake-api** handles:

- Image upload and serving
- Location ETA computation (coordinates stay server-side)
- Payment webhooks and penalty logic (Stripe)
- Admin operations for curated communities

Configure the API URL in `.env.local`:

```
VITE_API_BASE_URL=http://localhost:5001
```

## Firebase

| Service | Role |
|---|---|
| **Authentication** | Email/password (Google/Apple later) |
| **Firestore** | Users, communities, listings, agreements, messages |
| **FCM** | Push notifications for meetups and chat |

The app talks to Firestore directly where security rules allow. firmshake-api validates Firebase ID tokens for privileged endpoints.

## Communities

| Type | Created by | Example |
|---|---|---|
| **Admin-curated** | Platform admin via API or Firebase console | "St. Mary's Church" |
| **User-created** | Any authenticated user | "Miata Enthusiasts SF" |

Listings carry `communityIds: string[]`. Inclusion of `all` means visible in the global feed.

## Meetup location

| Mode | Flow |
|---|---|
| **Seller-proposed** | Seller sets address or map pin when accepting a buyer offer |
| **Mutually agreed** | Either party proposes a pin; both must confirm before binding |

## Related repo

| Repo | Purpose |
|---|---|
| **firmshake** | This client |
| **firmshake-api** | Flask server — see its `docs/ARCHITECTURE.md` for API design |

For the planned Backend-for-Frontend migration strategy, see [BFF_PLAN.md](./BFF_PLAN.md).
