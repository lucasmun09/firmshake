# Saved listings sync (bookmarks)

Cross-device sync for bookmarks **without** a payment processor. Local-first UX stays; Firestore is the durable per-user store.

## What you need to do

1. Deploy Firestore rules that allow `users/{uid}/savedListings/{listingId}` (owner read/write) — included in this repo’s `firestore.rules`.
2. Redeploy rules to deovo: `npm run firebase:deploy-rules` (project `firmshake-dev`) — only if rules changed; soft-tombstone fields use the same owner write rule.
3. Verify: save a listing on device A → sign in on device B → open **Saved** (or Browse bookmark state) and confirm the listing appears after bootstrap hydrate.
4. Verify delete race: unsave on device A (airplane / kill before sync) → reopen → hydrate must **not** resurrect the bookmark; `/logs` shows `tombstonedCount` ≥ 1 when remote was stale.
5. Inspect `/logs` for category `saved-listings` (`hydrate.start` / `hydrate.done` / `toggle.sync`).

No API/BFF route in this phase. BFF can mirror `blockedUsers` later behind `VITE_USE_BFF_USERS` if writes need to leave the client.

## Model

| Layer | Path / key | Role |
|---|---|---|
| Local cache | `localStorage` via `listingPrefsStorage` (`saved-listings` namespace, payload **v2**) | Instant paint, offline toggle, anonymous prefs, **delete tombstones** |
| Remote | `users/{uid}/savedListings/{listingId}` | Cross-device durability (active docs + soft-delete tombstones) |

**Active doc fields:** `listingId`, `title`, `price`, `imageUrl`, `savedAt` (epoch ms), `deleted: false`.

**Tombstone doc fields:** `listingId`, `deleted: true`, `deletedAt` (epoch ms); title/price/image cleared.

**Local tombstone:** `{ id, deletedAt }` in the same prefs payload (`tombstonesById`), capped at **100**.

Cap for active saves: **50** (`SAVED_LISTINGS_MAX`).

Anonymous / guest: local only — no Firestore writes (local tombstones still apply within the device).

## Behavior

1. **Toggle (save/unsave):** update local immediately (unsave writes a tombstone; save clears it) → fire-and-forget remote upsert / soft-tombstone when signed in.
2. **Bootstrap hydrate** (`startAppBootstrap`): fetch remote entries + tombstones → LWW merge with local (`deletedAt >= savedAt` ⇒ delete wins) → write local → push `toUpsert` / `toTombstone` gaps.
3. **User switch:** existing `clearListingPrefsIfUserChanged` clears prior owner local prefs (including tombstones) before hydrate.

Last-write-wins across devices: a newer remote save beats a local tombstone; a newer tombstone beats a stale remote/local save so unsaved-but-not-yet-synced deletes do not reappear after hydrate.

## Modules

| File | Concern |
|---|---|
| `savedListings.ts` | Local CRUD + tombstones + prefs owner helpers |
| `savedListingsRemote.ts` | Firestore fetch / upsert / soft-tombstone |
| `savedListingsMerge.ts` | Pure LWW merge (`mergeSavedListingsState`) |
| `savedListingsSync.ts` | Hydrate + toggle push orchestration |
| `useListingBookmark.ts` | UI toggle + revision bump + sync call |
| `appBootstrap.ts` | Schedules hydrate after auth wait |

## Tests

```bash
npm run test:unit -- --run \
  tests/unit/savedListings.spec.ts \
  tests/unit/savedListingsMerge.spec.ts \
  tests/unit/savedListingsSync.spec.ts \
  tests/unit/savedListingsRemote.spec.ts \
  tests/unit/integration/marketplaceSavedFlow.spec.ts
```

## When to redeploy

| Change | Redeploy |
|---|---|
| `firestore.rules` | `npm run firebase:deploy-rules` |
| Client sync / UI wiring | `npm run deploy:hosting` (deovo) |
| API (none yet) | n/a |
