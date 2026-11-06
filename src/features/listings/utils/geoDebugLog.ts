import { debugLog } from '@/common/debug/debugLog';
import type { GeoFilterState } from '@/features/listings/services/geoFilterStorage';
import type { BrowseGeoFilterParams } from '@/features/listings/utils/browseFilters';
import { haversineDistanceMiles, milesToKm } from '@/features/listings/utils/geoDistance';
import type { Listing } from '@/types';

const MAX_LISTINGS_IN_LOG = 50;

export type GeoFilterChangeSource =
  | 'toggle-on'
  | 'toggle-off'
  | 'radius'
  | 'geolocation'
  | 'address'
  | 'clear'
  | 'hydrate'
  | 'apply';

export type GeoListingSummary = {
  id: string;
  title: string;
  distanceMi: number | null;
  lat: number | null;
  lng: number | null;
  hasImage: boolean;
};

export function buildGeoFilterInputPayload(
  state: Pick<GeoFilterState, 'enabled' | 'lat' | 'lng' | 'radiusMiles' | 'label'> & {
    locating?: boolean;
  },
): Record<string, unknown> {
  return {
    enabled: state.enabled,
    lat: state.lat,
    lng: state.lng,
    radiusMiles: state.radiusMiles,
    radiusKm: Math.round(milesToKm(state.radiusMiles) * 100) / 100,
    centerLabel: state.label || null,
    locating: state.locating ?? false,
  };
}

export function logGeoFilterInputChanged(
  state: Pick<GeoFilterState, 'enabled' | 'lat' | 'lng' | 'radiusMiles' | 'label'> & {
    locating?: boolean;
  },
  source: GeoFilterChangeSource,
  extra?: Record<string, unknown>,
): void {
  debugLog.info('browse-geo', 'Geo filter input changed', {
    source,
    ...buildGeoFilterInputPayload(state),
    ...extra,
  });
}

export function summarizeListingForGeoLog(
  listing: Listing,
  center: BrowseGeoFilterParams,
): GeoListingSummary {
  const lat = listing.location?.lat ?? null;
  const lng = listing.location?.lng ?? null;
  const distanceMi =
    lat != null && lng != null
      ? Math.round(haversineDistanceMiles(center.lat, center.lng, lat, lng) * 10) / 10
      : null;

  return {
    id: listing.id,
    title: listing.title,
    distanceMi,
    lat,
    lng,
    hasImage: Boolean(listing.imageUrl || listing.imageUrls?.length),
  };
}

export function summarizeListingsForGeoLog(
  listings: Listing[],
  center: BrowseGeoFilterParams,
): GeoListingSummary[] {
  return listings
    .slice(0, MAX_LISTINGS_IN_LOG)
    .map((listing) => summarizeListingForGeoLog(listing, center));
}

export function logGeoFilterApplied(options: {
  input: {
    enabled: boolean;
    lat: number;
    lng: number;
    radiusMiles: number;
    radiusKm: number;
    centerLabel: string;
    query?: string;
    communityId?: string;
    categoryId?: string | null;
  };
  beforeCount: number;
  afterCount: number;
  excludedNoLocation: number;
  matched: Listing[];
  source: 'local-feed' | 'cache-stale' | 'apply-trigger';
}): void {
  const center: BrowseGeoFilterParams = {
    lat: options.input.lat,
    lng: options.input.lng,
    radiusKm: options.input.radiusKm,
  };

  debugLog.info('browse-geo', 'Geo filter applied', {
    source: options.source,
    input: options.input,
    output: {
      beforeCount: options.beforeCount,
      afterCount: options.afterCount,
      excludedNoLocation: options.excludedNoLocation,
      truncated: options.matched.length > MAX_LISTINGS_IN_LOG,
      listingIds: options.matched.slice(0, MAX_LISTINGS_IN_LOG).map((listing) => listing.id),
      listings: summarizeListingsForGeoLog(options.matched, center),
    },
  });
}

export function logGeoFilterOutcome(
  before: Listing[],
  after: Listing[],
  geoInput: {
    enabled: boolean;
    lat: number;
    lng: number;
    radiusMiles: number;
    centerLabel: string;
    query?: string;
    communityId?: string;
    categoryId?: string | null;
  },
  source: 'local-feed' | 'cache-stale' | 'apply-trigger',
): void {
  const excludedNoLocation = before.filter(
    (listing) => listing.location?.lat == null || listing.location?.lng == null,
  ).length;

  logGeoFilterApplied({
    input: {
      ...geoInput,
      radiusKm: Math.round(milesToKm(geoInput.radiusMiles) * 100) / 100,
    },
    beforeCount: before.length,
    afterCount: after.length,
    excludedNoLocation,
    matched: after,
    source,
  });
}

export function logListingSearchResults(
  params: {
    q?: string;
    communityId?: string;
    categoryId?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    page?: number;
    pageSize?: number;
  },
  result: {
    listings: Listing[];
    total: number;
    hasMore: boolean;
  },
  fromCache: boolean,
): void {
  const hasGeo = params.lat != null && params.lng != null && params.radiusKm != null;
  const center = hasGeo
    ? { lat: params.lat!, lng: params.lng!, radiusKm: params.radiusKm! }
    : null;

  debugLog.info('browse-geo', 'Listing search API result', {
    fromCache,
    input: {
      q: params.q ?? null,
      communityId: params.communityId ?? null,
      categoryId: params.categoryId ?? null,
      lat: params.lat ?? null,
      lng: params.lng ?? null,
      radiusKm: params.radiusKm ?? null,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 24,
    },
    output: {
      total: result.total,
      count: result.listings.length,
      hasMore: result.hasMore,
      listingIds: result.listings.slice(0, MAX_LISTINGS_IN_LOG).map((listing) => listing.id),
      listings: center
        ? summarizeListingsForGeoLog(result.listings, center)
        : result.listings.slice(0, MAX_LISTINGS_IN_LOG).map((listing) => ({
            id: listing.id,
            title: listing.title,
            hasImage: Boolean(listing.imageUrl || listing.imageUrls?.length),
            lat: listing.location?.lat ?? null,
            lng: listing.location?.lng ?? null,
          })),
      truncated: result.listings.length > MAX_LISTINGS_IN_LOG,
    },
  });
}
