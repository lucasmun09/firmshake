import { debugLog } from '@/common/debug/debugLog';
import {
  buildCacheKey,
  getCached,
  invalidateCached,
  invalidateCachedNamespace,
  setCached,
} from '@/common/services/responseCache';
import {
  listingsFromBrowseSummaryResult,
  summarizeBrowseSearchResult,
  type BrowseSummarySearchResult,
} from '@/features/listings/services/browseSearchSummary';
import {
  fetchBrowseSearchEndpoint,
  type BrowseSearchApiPayload,
  type BrowseSearchParams,
  type BrowseSort,
} from '@/features/listings/services/browseSearchRequest';
import { logListingSearchResults } from '@/features/listings/utils/geoDebugLog';
import {
  hydrateBrowseMapPinGroups,
  type BrowseMapPinGroup,
  type BrowseMapPinGroupSummary,
} from '@/features/listings/utils/browseMapPinAggregation';
import { isApiConfigured } from '@/utils/apiBaseUrl';
import type { Listing } from '@/types';

export type { BrowseSearchParams, BrowseSort };

export interface BrowseSearchResult {
  listings: Listing[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  engine?: string;
  pinGroups?: BrowseMapPinGroup[];
}

function mapBrowseHit(hit: Record<string, unknown>): Listing {
  const imageUrl = String(hit.imageUrl ?? '');
  const communityIds = Array.isArray(hit.communityIds)
    ? hit.communityIds.map(String)
    : [];
  const location = hit.location as Record<string, unknown> | undefined;
  const locationArray = Array.isArray(hit.location) ? hit.location : null;

  return {
    id: String(hit.id ?? ''),
    title: String(hit.title ?? ''),
    titleLower: String(hit.titleLower ?? hit.title ?? '').toLowerCase(),
    description: String(hit.description ?? ''),
    price: Number(hit.price ?? 0),
    imageUrl,
    imageUrls: Array.isArray(hit.imageUrls)
      ? hit.imageUrls.map(String)
      : imageUrl
        ? [imageUrl]
        : [],
    sellerId: String(hit.sellerId ?? ''),
    sellerName: String(hit.sellerName ?? ''),
    communityIds,
    primaryCategoryId: String(hit.primaryCategoryId ?? 'general'),
    categoryIds: Array.isArray(hit.categoryIds) ? hit.categoryIds.map(String) : [],
    status: (hit.status as Listing['status']) ?? 'active',
    createdAt: hit.createdAt ? new Date(Number(hit.createdAt)) : undefined,
    location:
      location && location.lat != null && location.lng != null
        ? {
            lat: Number(location.lat),
            lng: Number(location.lng),
            geohash: location.geohash ? String(location.geohash) : undefined,
            city: location.city ? String(location.city) : undefined,
            region: location.region ? String(location.region) : undefined,
            label: location.label ? String(location.label) : undefined,
          }
        : locationArray && locationArray.length === 2
          ? {
              lat: Number(locationArray[0]),
              lng: Number(locationArray[1]),
              geohash: hit.geohash ? String(hit.geohash) : undefined,
              city: hit.city ? String(hit.city) : undefined,
              region: hit.region ? String(hit.region) : undefined,
            }
          : undefined,
  };
}

function resultFromPayload(payload: BrowseSearchApiPayload): BrowseSearchResult {
  const listings = payload.listings.map(mapBrowseHit);
  const pinGroups = payload.pinGroups?.length
    ? hydrateBrowseMapPinGroups(payload.pinGroups as BrowseMapPinGroupSummary[], listings)
    : undefined;

  return {
    listings,
    total: payload.total,
    page: payload.page,
    pageSize: payload.pageSize,
    hasMore: payload.hasMore,
    engine: payload.engine,
    pinGroups,
  };
}

/**
 * Prefer local-first `/summary` (smaller payload). Fall back to full `/search`
 * when the API has not been upgraded yet (404) or summary fails transiently.
 */
async function fetchBrowseListingsPreferSummary(
  params: BrowseSearchParams,
  page: number,
  pageSize: number,
): Promise<BrowseSearchResult> {
  const summaryAttempt = await fetchBrowseSearchEndpoint('summary', params, page, pageSize);
  if (summaryAttempt.ok) {
    debugLog.debug('browse-bff', 'browse.summary.hit', {
      page,
      pageSize,
      total: summaryAttempt.payload.total,
      shape: summaryAttempt.payload.shape,
    });
    return resultFromPayload(summaryAttempt.payload);
  }

  debugLog.info('browse-bff', 'browse.summary.fallback_search', {
    status: summaryAttempt.status,
    page,
  });

  const searchAttempt = await fetchBrowseSearchEndpoint('search', params, page, pageSize);
  if (!searchAttempt.ok) {
    debugLog.warn('browse-bff', 'Browse search request failed', {
      status: searchAttempt.status,
      page,
    });
    throw new Error('Search is temporarily unavailable');
  }

  return resultFromPayload(searchAttempt.payload);
}

export async function searchBrowseListings(
  params: BrowseSearchParams,
): Promise<BrowseSearchResult> {
  if (!isApiConfigured()) {
    return { listings: [], total: 0, page: 1, pageSize: params.pageSize ?? 24, hasMore: false };
  }

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 24;
  const cacheKey = browseSearchCacheKey({ ...params, page, pageSize });

  if (!params.forceRefresh) {
    const cached = getCached<BrowseSummarySearchResult>(cacheKey);
    if (cached) {
      const listings = listingsFromBrowseSummaryResult(cached);
      const pinGroups = cached.pinGroups?.length
        ? hydrateBrowseMapPinGroups(cached.pinGroups, listings)
        : undefined;
      const result: BrowseSearchResult = {
        ...cached,
        listings,
        pinGroups,
      };
      logListingSearchResults({ ...params, page, pageSize }, result, true);
      return result;
    }
  }

  const result = await fetchBrowseListingsPreferSummary(params, page, pageSize);

  setCached(cacheKey, summarizeBrowseSearchResult(result));
  logListingSearchResults(
    {
      ...params,
      page,
      pageSize,
      radiusKm:
        params.radiusMiles != null
          ? params.radiusMiles * 1.60934
          : undefined,
    },
    result,
    false,
  );
  return result;
}

export function browseSearchCacheKey(
  params: Omit<BrowseSearchParams, 'forceRefresh'>,
): string {
  return buildCacheKey('browse-search', {
    tab: 'browse',
    q: params.q ?? '',
    community: params.communityId ?? '',
    category: params.categoryId ?? '',
    categories: (params.categoryIds ?? []).join(','),
    minPrice: params.priceMin ?? '',
    maxPrice: params.priceMax ?? '',
    hasLocation: params.hasLocation ?? '',
    lat: params.lat ?? '',
    lng: params.lng ?? '',
    radiusMiles: params.radiusMiles ?? '',
    sort: params.sort ?? 'newest',
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 24,
  });
}

export function invalidateBrowseSearchCache(cacheKey?: string): void {
  if (cacheKey) {
    invalidateCached(cacheKey);
    return;
  }

  invalidateCachedNamespace('browse-search');
}

/** @deprecated Use searchBrowseListings — legacy GET /api/listings/search wrapper. */
export async function searchListingsLegacy(params: BrowseSearchParams): Promise<BrowseSearchResult> {
  debugLog.warn('browse', 'searchListingsLegacy called — prefer searchBrowseListings');
  return searchBrowseListings(params);
}
