import { ALL_COMMUNITY_ID } from '@/features/communities/data/seedCommunities';
import type { BrowseSort } from '@/features/listings/services/browseSearch';
import {
  applyBrowseFilters,
  type BrowseGeoFilterParams,
} from '@/features/listings/utils/browseFilters';
import { appendBrowseListings } from '@/features/listings/utils/browsePaginationUi';
import { haversineDistanceKm } from '@/features/listings/utils/geohash';
import type { Listing } from '@/types';

export interface BrowseLocalFilterParams {
  query?: string;
  categoryId?: string;
  priceMin?: number | null;
  priceMax?: number | null;
  geo?: BrowseGeoFilterParams | null;
  communityId?: string;
  sort?: BrowseSort;
}

function listingMatchesCommunity(listing: Listing, communityId: string): boolean {
  if (!communityId || communityId === ALL_COMMUNITY_ID) {
    return true;
  }

  return listing.communityIds.includes(communityId);
}

function listingMatchesCategory(listing: Listing, categoryId: string): boolean {
  if (!categoryId) {
    return true;
  }

  return (
    listing.primaryCategoryId === categoryId || listing.categoryIds.includes(categoryId)
  );
}

function listingMatchesPrice(
  listing: Listing,
  priceMin: number | null | undefined,
  priceMax: number | null | undefined,
): boolean {
  if (priceMin != null && listing.price < priceMin) {
    return false;
  }

  if (priceMax != null && listing.price > priceMax) {
    return false;
  }

  return true;
}

function sortBrowseListingsLocally(
  listings: Listing[],
  sort: BrowseSort,
  geo?: BrowseGeoFilterParams | null,
): Listing[] {
  const copy = [...listings];

  switch (sort) {
    case 'price_asc':
      return copy.sort((left, right) => left.price - right.price);
    case 'price_desc':
      return copy.sort((left, right) => right.price - left.price);
    case 'distance': {
      if (!geo) {
        return copy;
      }

      const origin = { lat: geo.lat, lng: geo.lng };
      return copy.sort((left, right) => {
        const leftDistance =
          left.location?.lat != null && left.location?.lng != null
            ? haversineDistanceKm(origin, left.location)
            : Number.POSITIVE_INFINITY;
        const rightDistance =
          right.location?.lat != null && right.location?.lng != null
            ? haversineDistanceKm(origin, right.location)
            : Number.POSITIVE_INFINITY;
        return leftDistance - rightDistance;
      });
    }
    case 'newest':
    default:
      return copy.sort(
        (left, right) =>
          (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0),
      );
  }
}

/** Client-side filter for already-loaded browse listings (keyword, geo, category, price, community). */
export function filterLoadedBrowseListings(
  listings: Listing[],
  params: BrowseLocalFilterParams,
): Listing[] {
  let filtered = listings.filter(
    (listing) =>
      listingMatchesCommunity(listing, params.communityId ?? ALL_COMMUNITY_ID) &&
      listingMatchesCategory(listing, params.categoryId ?? '') &&
      listingMatchesPrice(listing, params.priceMin, params.priceMax),
  );

  filtered = applyBrowseFilters(filtered, {
    query: params.query,
    geo: params.geo ?? null,
  });

  const query = params.query?.trim();
  if (!query) {
    filtered = sortBrowseListingsLocally(filtered, params.sort ?? 'newest', params.geo);
  }

  return filtered;
}

/** Merge listing arrays without duplicate IDs; incoming entries win on conflict. */
export function mergeBrowseListingsById(
  existing: Listing[],
  incoming: Listing[],
): Listing[] {
  if (incoming.length === 0) {
    return existing;
  }

  const byId = new Map(existing.map((listing) => [listing.id, listing]));
  for (const listing of incoming) {
    byId.set(listing.id, listing);
  }

  return Array.from(byId.values());
}

/** Append unique listings — convenience wrapper around pagination helper. */
export function appendUniqueBrowseListings(
  existing: Listing[],
  incoming: Listing[],
): Listing[] {
  return appendBrowseListings(existing, incoming);
}
