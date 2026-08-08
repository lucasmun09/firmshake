import {
  matchesListingSearchQuery,
  sortListingsBySearchRelevance,
} from '@/features/listings/utils/browseSearchRanking';
import { haversineDistanceKm } from '@/features/listings/utils/geohash';
import type { Listing } from '@/types';

export interface BrowseGeoFilterParams {
  lat: number;
  lng: number;
  radiusKm: number;
}

export function filterListingsByGeoCenter(
  listings: Listing[],
  center: BrowseGeoFilterParams | null,
): Listing[] {
  if (!center) {
    return listings;
  }

  const origin = { lat: center.lat, lng: center.lng };

  return listings.filter((listing) => {
    if (listing.location?.lat == null || listing.location?.lng == null) {
      return false;
    }

    return haversineDistanceKm(origin, listing.location) <= center.radiusKm;
  });
}

export function applyBrowseFilters(
  listings: Listing[],
  options: {
    query?: string;
    geo?: BrowseGeoFilterParams | null;
  },
): Listing[] {
  let filtered = listings;
  const query = options.query?.trim();

  if (query) {
    filtered = filtered.filter((listing) => matchesListingSearchQuery(listing, query));
    filtered = sortListingsBySearchRelevance(filtered, query);
  }

  return filterListingsByGeoCenter(filtered, options.geo ?? null);
}
