import { debugLog } from '@/common/debug/debugLog';
import {
  fetchBrowseSearchEndpoint,
  type BrowseSearchParams,
} from '@/features/listings/services/browseSearchRequest';
import type {
  BrowseMapPinGroup,
  BrowseMapPinGroupSummary,
} from '@/features/listings/utils/browseMapPinAggregation';
import {
  listingSummaryToListing,
  summarizeListings,
  toListingSummary,
  type ListingSummary,
} from '@/features/listings/utils/listingSummary';
import type { Listing } from '@/types';

/** Minimal full-search shape accepted by the cache strip helper (avoids circular import). */
export interface BrowseSearchResultLike {
  listings: Listing[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  engine?: string;
  pinGroups?: BrowseMapPinGroup[];
}

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

function mapSummaryHit(hit: Record<string, unknown>): ListingSummary {
  const imageUrl = String(hit.imageUrl ?? '');
  const location = hit.location as Record<string, unknown> | undefined;
  const locationArray = Array.isArray(hit.location) ? hit.location : null;

  return {
    id: String(hit.id ?? ''),
    title: String(hit.title ?? ''),
    price: Number(hit.price ?? 0),
    imageUrl,
    status: (hit.status as Listing['status']) ?? 'active',
    sellerId: String(hit.sellerId ?? ''),
    communityIds: Array.isArray(hit.communityIds) ? hit.communityIds.map(String) : [],
    primaryCategoryId: String(hit.primaryCategoryId ?? 'general'),
    createdAt: hit.createdAt ? new Date(Number(hit.createdAt)) : undefined,
    location:
      location && location.lat != null && location.lng != null
        ? {
            lat: Number(location.lat),
            lng: Number(location.lng),
            geohash: location.geohash ? String(location.geohash) : undefined,
            city: location.city ? String(location.city) : undefined,
            region: location.region ? String(location.region) : undefined,
          }
        : locationArray && locationArray.length === 2
          ? {
              lat: Number(locationArray[0]),
              lng: Number(locationArray[1]),
            }
          : undefined,
  };
}

/** Strip heavy fields from a full search result before cache persistence. */
export function summarizeBrowseSearchResult(result: BrowseSearchResultLike): BrowseSummarySearchResult {
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
 * Local-first browse search — calls `/api/v1/browse/summary` when available,
 * otherwise falls back to `/search` and strips client-side.
 */
export async function searchBrowseSummaryListings(
  params: BrowseSearchParams,
): Promise<BrowseSummarySearchResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 24;

  const summaryAttempt = await fetchBrowseSearchEndpoint('summary', params, page, pageSize);
  if (summaryAttempt.ok) {
    debugLog.debug('browse-bff', 'browseSummary.direct.hit', {
      page,
      total: summaryAttempt.payload.total,
    });
    return {
      listings: summaryAttempt.payload.listings.map(mapSummaryHit),
      total: summaryAttempt.payload.total,
      page: summaryAttempt.payload.page,
      pageSize: summaryAttempt.payload.pageSize,
      hasMore: summaryAttempt.payload.hasMore,
      engine: summaryAttempt.payload.engine,
      pinGroups: summaryAttempt.payload.pinGroups,
    };
  }

  debugLog.info('browse-bff', 'browseSummary.direct.fallback_search', {
    status: summaryAttempt.status,
  });

  const searchAttempt = await fetchBrowseSearchEndpoint('search', params, page, pageSize);
  if (!searchAttempt.ok) {
    throw new Error('Search is temporarily unavailable');
  }

  const listings = searchAttempt.payload.listings.map((hit) =>
    toListingSummary({
      id: String(hit.id ?? ''),
      title: String(hit.title ?? ''),
      titleLower: String(hit.title ?? '').toLowerCase(),
      description: String(hit.description ?? ''),
      price: Number(hit.price ?? 0),
      imageUrl: String(hit.imageUrl ?? ''),
      imageUrls: Array.isArray(hit.imageUrls) ? hit.imageUrls.map(String) : [],
      sellerId: String(hit.sellerId ?? ''),
      sellerName: String(hit.sellerName ?? ''),
      communityIds: Array.isArray(hit.communityIds) ? hit.communityIds.map(String) : [],
      primaryCategoryId: String(hit.primaryCategoryId ?? 'general'),
      categoryIds: Array.isArray(hit.categoryIds) ? hit.categoryIds.map(String) : [],
      status: (hit.status as Listing['status']) ?? 'active',
    }),
  );

  return {
    listings,
    total: searchAttempt.payload.total,
    page: searchAttempt.payload.page,
    pageSize: searchAttempt.payload.pageSize,
    hasMore: searchAttempt.payload.hasMore,
    engine: searchAttempt.payload.engine,
    pinGroups: searchAttempt.payload.pinGroups,
  };
}
