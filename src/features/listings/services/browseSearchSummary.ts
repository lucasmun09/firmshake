import type { BrowseMapPinGroupSummary } from '@/features/listings/utils/browseMapPinAggregation';
import {
  searchBrowseListings,
  type BrowseSearchParams,
  type BrowseSearchResult,
} from '@/features/listings/services/browseSearch';
import {
  listingSummaryToListing,
  summarizeListings,
  type ListingSummary,
} from '@/features/listings/utils/listingSummary';

/** Response shape for the phased `POST /api/v1/browse/summary` endpoint. */
export interface BrowseSummarySearchResult {
  listings: ListingSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  engine?: string;
  /** Seller-aggregated map pins (listingIds only). */
  pinGroups?: BrowseMapPinGroupSummary[];
}

/** Strip heavy fields from a full search result before cache persistence. */
export function summarizeBrowseSearchResult(result: BrowseSearchResult): BrowseSummarySearchResult {
  const pinGroups = result.pinGroups?.map((group) => ({
    key: group.key,
    kind: group.kind,
    sellerId: group.sellerId,
    position: group.position,
    listingIds: group.listings.map((listing) => listing.id),
  }));

  return {
    ...result,
    listings: summarizeListings(result.listings),
    pinGroups,
  };
}

/** Revive summarized search results to Listing[] for existing browse UI. */
export function listingsFromBrowseSummaryResult(result: BrowseSummarySearchResult) {
  return result.listings.map(listingSummaryToListing);
}

/**
 * Browse search entry point for local-first caching.
 * Phase 2: call `/api/v1/browse/summary` directly when available.
 */
export async function searchBrowseSummaryListings(
  params: BrowseSearchParams,
): Promise<BrowseSummarySearchResult> {
  const result = await searchBrowseListings(params);
  return summarizeBrowseSearchResult(result);
}
