# Product QoL polish (no payments)

Minor usability improvements shipped after dual-stack merge.

## What changed

| Improvement | Why |
|---|---|
| Browse empty state “Clear filters” | Empty search/filter results previously only showed a hint; one tap resets search, category, price, geo, and sort |
| Scroll to top on Apply / Enter search | Keeps results in view after filter or immediate search flush |
| Enter key flushes browse search | Skips debounce when the user commits a query |
| Saved “X ago” timestamps | Easier to scan recent bookmarks |
| Bookmark toasts: View / Undo | Faster path to Saved after save; accidental unsave is recoverable |

## Modules

- `src/features/listings/utils/browseEmptyState.ts`
- `src/common/utils/formatRelativeTime.ts`
- `src/features/listings/composables/useListingBookmark.ts`
- `HomePage.vue` / `SavedListingsPage.vue`

## Tests

```bash
npm run test:unit -- --run tests/unit/browseEmptyState.spec.ts tests/unit/formatRelativeTime.spec.ts
```
