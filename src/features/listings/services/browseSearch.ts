import { debugLog } from '@/common/debug/debugLog';
import { loggedFetch } from '@/common/debug/loggedFetch';
import { authHeaders } from '@/common/services/api';
import { logListingSearchResults } from '@/features/listings/utils/geoDebugLog';
import {
  buildCacheKey,
  getCached,
  invalidateCached,
  invalidateCachedNamespace,
  setCached,
} from '@/common/services/responseCache';
import { getApiBaseUrl, isApiConfigured } from '@/utils/apiBaseUrl';
import type { Listing } from '@/types';

export type BrowseSort = 'newest' | 'price_asc' | 'price_desc' | 'distance';

export interface BrowseSearchParams {
  q?: string;
  communityId?: string;
  categoryId?: string;
  categoryIds?: string[];
  priceMin?: number;
  priceMax?: number;
  hasLocation?: boolean;
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  sort?: BrowseSort;
  page?: number;
  pageSize?: number;
  forceRefresh?: boolean;
}

export interface BrowseSearchResult {
  listings: Listing[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  engine?: string;
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
    const cached = getCached<BrowseSearchResult>(cacheKey);
    if (cached) {
      logListingSearchResults({ ...params, page, pageSize }, cached, true);
      return cached;
    }
  }

  const body: Record<string, unknown> = {
    communityId: params.communityId ?? 'all',
    page,
    pageSize,
    sort: params.sort ?? 'newest',
  };

  if (params.q) body.q = params.q;
  if (params.categoryId) body.categoryId = params.categoryId;
  if (params.categoryIds?.length) body.categoryIds = params.categoryIds;
  if (params.priceMin != null) body.priceMin = params.priceMin;
  if (params.priceMax != null) body.priceMax = params.priceMax;
  if (params.hasLocation != null) body.hasLocation = params.hasLocation;
  if (params.lat != null) body.lat = params.lat;
  if (params.lng != null) body.lng = params.lng;
  if (params.radiusMiles != null) body.radiusMiles = params.radiusMiles;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const auth = await authHeaders();
  if (typeof auth === 'object' && auth && 'Authorization' in auth && auth.Authorization) {
    headers.Authorization = String(auth.Authorization);
  }

  const response = await loggedFetch(
    `${getApiBaseUrl()}/api/v1/browse/search`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    },
    { category: 'browse-bff', label: 'POST /api/v1/browse/search' },
  );

  if (!response.ok) {
    let detail = '';
    try {
      const errorPayload = (await response.json()) as { error?: string };
      detail = errorPayload.error ?? '';
    } catch {
      // Response body may not be JSON.
    }

    debugLog.warn('browse-bff', 'Browse search request failed', {
      status: response.status,
      detail: detail || undefined,
      request: body,
    });
    throw new Error('Search is temporarily unavailable');
  }

  const payload = (await response.json()) as {
    listings: Record<string, unknown>[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    engine?: string;
  };

  const result: BrowseSearchResult = {
    listings: payload.listings.map(mapBrowseHit),
    total: payload.total,
    page: payload.page,
    pageSize: payload.pageSize,
    hasMore: payload.hasMore,
    engine: payload.engine,
  };

  setCached(cacheKey, result);
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
