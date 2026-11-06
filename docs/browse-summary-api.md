# Browse summary API (local-first)

Phased lightweight browse response so cards/map caches transfer **ListingSummary** fields only. Full listing detail (description, gallery, seller profile) stays on-demand via listing detail.

Cross-reference: `.cursor/rules/firmshake-local-first.mdc`, client `browseSearchSummary.ts`, API `services/browse_summary.py`.

## What you need to do

1. **Deploy API** with `POST /api/v1/browse/summary` (this PR / staging Cloud Run).
2. **Deploy web** — client prefers `/summary` and falls back to `/search` on 404/5xx so mixed deploys stay safe.
3. **Verify** — open Browse on deovo; `/logs` should show `POST /api/v1/browse/summary` (or fallback to `/search` until API is live). Spot-check a card still shows title/price/primary image.
4. **No console secrets** — endpoint is guest-accessible (optional Bearer for block-list filtering), same as `/search`.

Redeploy: API staging first (`bash scripts/deploy-staging.sh` in firmshake-api), then `npm run deploy:hosting` for the web client.

## Contract

| Item | Detail |
|---|---|
| Method / path | `POST /api/v1/browse/summary` |
| Request body | Same as `/api/v1/browse/search` (`q`, `communityId`, `categoryId(s)`, price, geo, `sort`, `page`, `pageSize`) |
| Auth | Optional Bearer — enables block-list filtering |
| Cache header | `X-Browse-Cache: HIT\|MISS` (separate key namespace from full `/search`) |

### Listing fields (per hit)

Kept: `id`, `title`, `price`, `imageUrl`, `status`, `sellerId`, `communityIds`, `primaryCategoryId`, `location?`, `createdAt?`

Omitted: `description`, `imageUrls`, `sellerName`, `categoryIds`, `titleLower`

### Envelope

```json
{
  "listings": [/* ListingSummary */],
  "total": 0,
  "page": 1,
  "pageSize": 24,
  "hasMore": false,
  "engine": "typesense|firestore",
  "pinGroups": [{ "key": "…", "kind": "single|aggregated", "sellerId": "…", "position": { "lat": 0, "lng": 0 }, "listingIds": ["…"] }],
  "shape": "summary"
}
```

## Client wiring

| Module | Role |
|---|---|
| `browseSearchRequest.ts` | Shared POST body + fetch for `/search` and `/summary` |
| `browseSearch.ts` | Prefer `/summary`, revive summaries to `Listing[]`, fall back to `/search` |
| `browseSearchSummary.ts` | Cache strip helpers + `searchBrowseSummaryListings()` |

## Tests

```bash
# API
cd ../firmshake-api && python -m pytest tests/test_browse_summary.py -q

# Web
npm run test:unit -- --run tests/unit/browseSearchSummary.spec.ts tests/unit/browseSearch.spec.ts tests/unit/browseSearchRequest.spec.ts
```
