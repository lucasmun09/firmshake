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
import type { ListingSearchDocument } from '@/features/listings/utils/listingSearchDocument';

export interface ListingSearchParams {
  q?: string;
  communityId?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  page?: number;
  pageSize?: number;
  forceRefresh?: boolean;
}

export interface ListingSearchResult {
  listings: Listing[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

function mapSearchHit(hit: Record<string, unknown>): Listing {
  const imageUrl = String(hit.imageUrl ?? '');
  const communityIds = Array.isArray(hit.communityIds)
    ? hit.communityIds.map(String)
    : [];

  return {
    id: String(hit.id ?? ''),
    title: String(hit.title ?? ''),
    titleLower: String(hit.title ?? '').toLowerCase(),
    description: String(hit.description ?? ''),
    price: Number(hit.price ?? 0),
    imageUrl,
    imageUrls: imageUrl ? [imageUrl] : [],
    sellerId: String(hit.sellerId ?? ''),
    sellerName: String(hit.sellerName ?? ''),
    communityIds,
    primaryCategoryId: String(hit.primaryCategoryId ?? 'general'),
    categoryIds: Array.isArray(hit.categoryIds) ? hit.categoryIds.map(String) : [],
    status: (hit.status as Listing['status']) ?? 'active',
    createdAt: hit.createdAt ? new Date(Number(hit.createdAt)) : undefined,
    location:
      Array.isArray(hit.location) && hit.location.length === 2
        ? {
            lat: Number(hit.location[0]),
            lng: Number(hit.location[1]),
            geohash: hit.geohash ? String(hit.geohash) : undefined,
            city: hit.city ? String(hit.city) : undefined,
            region: hit.region ? String(hit.region) : undefined,
          }
        : undefined,
  };
}

export async function searchListings(params: ListingSearchParams): Promise<ListingSearchResult> {
  if (!isApiConfigured()) {
    return { listings: [], total: 0, page: 1, pageSize: params.pageSize ?? 24, hasMore: false };
  }

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 24;
  const cacheKey = listingSearchCacheKey({ ...params, page, pageSize });

  if (!params.forceRefresh) {
    const cached = getCached<ListingSearchResult>(cacheKey);
    if (cached) {
      logListingSearchResults({ ...params, page, pageSize }, cached, true);
      return cached;
    }
  }

  const queryParams = new URLSearchParams();
  if (params.q) queryParams.set('q', params.q);
  if (params.communityId) queryParams.set('communityId', params.communityId);
  if (params.categoryId) queryParams.set('categoryId', params.categoryId);
  if (params.minPrice != null) queryParams.set('minPrice', String(params.minPrice));
  if (params.maxPrice != null) queryParams.set('maxPrice', String(params.maxPrice));
  if (params.lat != null) queryParams.set('lat', String(params.lat));
  if (params.lng != null) queryParams.set('lng', String(params.lng));
  if (params.radiusKm != null) queryParams.set('radiusKm', String(params.radiusKm));
  queryParams.set('page', String(page));
  queryParams.set('pageSize', String(pageSize));

  const response = await loggedFetch(
    `${getApiBaseUrl()}/api/listings/search?${queryParams.toString()}`,
    undefined,
    { category: 'listing', label: 'GET /api/listings/search' },
  );
  if (!response.ok) {
    throw new Error('Search is temporarily unavailable');
  }

  const payload = (await response.json()) as {
    listings: Record<string, unknown>[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };

  const result = {
    listings: payload.listings.map(mapSearchHit),
    total: payload.total,
    page: payload.page,
    pageSize: payload.pageSize,
    hasMore: payload.hasMore,
  };

  setCached(cacheKey, result);
  logListingSearchResults({ ...params, page, pageSize }, result, false);
  return result;
}

export function listingSearchCacheKey(
  params: Omit<ListingSearchParams, 'forceRefresh'>,
): string {
  return buildCacheKey('listing-search', {
    tab: 'browse',
    q: params.q ?? '',
    community: params.communityId ?? '',
    category: params.categoryId ?? '',
    minPrice: params.minPrice ?? '',
    maxPrice: params.maxPrice ?? '',
    lat: params.lat ?? '',
    lng: params.lng ?? '',
    radiusKm: params.radiusKm ?? '',
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 24,
  });
}

export function invalidateListingSearchCache(cacheKey?: string): void {
  if (cacheKey) {
    invalidateCached(cacheKey);
    return;
  }

  invalidateCachedNamespace('listing-search');
}

export async function syncListingSearchIndex(document: ListingSearchDocument): Promise<void> {
  if (!isApiConfigured()) {
    return;
  }

  try {
    await loggedFetch(`${getApiBaseUrl()}/api/listings/sync`, {
      method: 'POST',
      headers: {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(document),
    }, {
      category: 'listing',
      label: 'POST /api/listings/sync',
    });
  } catch (error) {
    debugLog.warn('listing', 'Listing search sync failed', { error });
  }
}
