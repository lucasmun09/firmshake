# Messaging / inbox thread modules

Parallel-agent friendly split of the former `threads.ts` monolith. Extends existing archive + unread patterns in `inboxState.ts` (see FirmShake design steering) — does **not** reinvent per-user archive or "New" badge rules.

## What you need to do

Nothing console-side for this doc. Use the module map when editing inbox/thread code so agents do not collide. No redeploy required for this doc alone; redeploy hosting when thread client modules change (`npm run deploy:hosting`).

## Module map

| Concern | File |
|---|---|
| Pure map/sort/merge/count + enrich | `src/features/messages/services/threadModel.ts` |
| Firestore thread writes + send-time sync | `src/features/messages/services/threadSync.ts` |
| Rebuild from notifications/listings/messages | `src/features/messages/services/threadRebuild.ts` |
| Live inbox subscription (threads + notification fallback) | `src/features/messages/services/threadSubscribe.ts` |
| Stable barrel (call-site imports) | `src/features/messages/services/threads.ts` |
| Archive / unread / partition | `src/features/messages/services/inboxState.ts` (unchanged) |
| BFF vs Firestore inbox router | `src/features/messages/services/inboxServiceRouter.ts` |
| Message send writes | `src/features/messages/services/messageFirestoreWrites.ts` / `messageBff.ts` |

## Invariants (do not break)

1. **Seller thread doc IDs** are `listingId_buyerId` via `sellerThreadDocId` — same key shape as `inboxStateDocId` for buyer threads under selling.
2. **Buyer thread doc IDs** are `listingId` only (buyer sees one row per listing).
3. **Archive is per-user** on `users/{uid}/inboxState` — never stored on shared `threads` docs.
4. **Unread / "New"** uses `isThreadUnread()` in `inboxState.ts` (`lastMessageSenderId !== currentUserId` + not archived).
5. **Notification merge** fills gaps when `users/{uid}/threads` is empty/stale; rebuild is best-effort and debounced.

## Gaps / missing components (next chunks)

| Gap | Notes |
|---|---|
| Thread pagination beyond `THREADS_PAGE_SIZE` (30) on Firestore path | Firestore subscribe still slices to 30; **BFF path** accumulates cursor pages (`accumulateInboxThreadPages`, max 10×30) when `VITE_USE_BFF_INBOX=true`. |
| ~~Dedicated `threadEnrich` cache~~ | **Done** — `threadEnrichCache.ts` (60s TTL, max 200); `enrichThreads` reads cache before `getListingsByIds`. |
| Selling buyer-thread count UI | `countBuyerThreadsForListing` is exported but unused — wire on Selling rows if product wants conversation counts. |
| Inbox BFF prod default-on | **Devo on** (`.env.devo` / CI). Prod stays **false** until authenticated deovo smoke. |
| Integration test for subscribe merge | Unit coverage covers pure merge/map + BFF page accumulate; live subscribe still manual / e2e. |

## How to verify

```bash
npm run test:unit -- --run tests/unit/threadModel.spec.ts tests/unit/threadRebuild.spec.ts tests/unit/inboxState.spec.ts tests/unit/inboxBffPages.spec.ts tests/unit/inboxServiceRouter.spec.ts
```

Open Inbox after sending a message as buyer and seller; confirm archive toggle and "New" badge still follow `inboxState` rules. Inspect `/logs` for `threads` category (`subscribeInboxThreads`, enrich failures).

## When to redeploy

Client-only: `npm run deploy:hosting` (devo). No API change in this split. Leave `PROD_DEPLOY_ENABLED` unset.
