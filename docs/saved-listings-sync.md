# Saved listings sync (bookmarks)

Cross-device sync for bookmarks **without** a payment processor. Local-first UX stays; Firestore is the durable per-user store.

## What you need to do

1. Deploy Firestore rules that allow `users/{uid}/savedListings/{listingId}` (owner read/write) — included in this repo’s `firestore.rules`.
2. Redeploy rules to deovo: `npm run firebase:deploy-rules` (project `firmshake-dev`).
3. Verify: save a listing on device A → sign in on device B → open **Saved** (or Browse bookmark state) and confirm the listing appears after bootstrap hydrate.
4. Inspect `/logs` for category `saved-listings` (`hydrate.start` / `hydrate.done` / `toggle.sync`).

No API/BFF route in this phase. BFF can mirror `blockedUsers` later behind `VITE_USE_BFF_USERS` if writes need to leave the client.

## Model

| Layer | Path / key | Role |
|---|---|---|
| Local cache | `localStorage` via `listingPrefsStorage` (`saved-listings` namespace) | Instant paint, offline toggle, anonymous prefs |
| Remote | `users/{uid}/savedListings/{listingId}` | Cross-device durability |

Doc fields: `listingId`, `title`, `price`, `imageUrl`, `savedAt` (epoch ms). Cap: **50** (`SAVED_LISTINGS_MAX`).

Anonymous / guest: local only — no Firestore writes.

## Behavior

1. **Toggle (save/unsave):** update local immediately → fire-and-forget remote upsert/delete when signed in.
2. **Bootstrap hydrate** (`startAppBootstrap`): fetch remote → merge with local (union by id, newer `savedAt` wins, trim to max) → write local → push local-only ids to remote.
3. **User switch:** existing `clearListingPrefsIfUserChanged` clears prior owner local prefs before hydrate.

No tombstones in v1: an unsaved-but-not-yet-synced delete can reappear after hydrate from another device’s older remote copy until that delete syncs.

## Modules

| File | Concern |
|---|---|
| `savedListings.ts` | Local CRUD + prefs owner helpers |
| `savedListingsRemote.ts` | Firestore fetch / upsert / delete |
| `savedListingsMerge.ts` | Pure merge + trim |
| `savedListingsSync.ts` | Hydrate + toggle push orchestration |
| `useListingBookmark.ts` | UI toggle + revision bump + sync call |
| `appBootstrap.ts` | Schedules hydrate after auth wait |

## Tests

```bash
npm run test:unit -- --run tests/unit/savedListings.spec.ts tests/unit/savedListingsMerge.spec.ts tests/unit/savedListingsSync.spec.ts
```

## When to redeploy

| Change | Redeploy |
|---|---|
| `firestore.rules` | `npm run firebase:deploy-rules` |
| Client sync / UI wiring | `npm run deploy:hosting` (deovo) |
| API (none yet) | n/a |
