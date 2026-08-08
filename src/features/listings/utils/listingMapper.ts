import { GeoPoint, type DocumentData } from 'firebase/firestore';

import { getDefaultCategoryId } from '@/features/listings/data/seedCategories';
import { ALL_COMMUNITY_ID } from '@/features/communities/data/seedCommunities';
import { matchesListingSearchQuery } from '@/features/listings/utils/browseSearchRanking';
import type { Listing, ListingFeedEntry, ListingLocation } from '@/types';
import { encodeGeohash } from '@/features/listings/utils/geohash';

export const LISTINGS_PAGE_SIZE = 24;

export function normalizeTitleLower(title: string): string {
  return title.trim().toLowerCase();
}

export function parseListingLocation(data: Record<string, unknown>): ListingLocation | undefined {
  const location = data.location;
  if (
    location &&
    typeof location === 'object' &&
    'latitude' in location &&
    'longitude' in location
  ) {
    const lat = Number((location as { latitude: number }).latitude);
    const lng = Number((location as { longitude: number }).longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return {
        lat,
        lng,
        city: data.city ? String(data.city) : undefined,
        region: data.region ? String(data.region) : undefined,
        label: data.locationLabel ? String(data.locationLabel) : undefined,
      };
    }
  }

  if (typeof data.geohash === 'string' && data.lat != null && data.lng != null) {
    return {
      lat: Number(data.lat),
      lng: Number(data.lng),
      geohash: String(data.geohash),
      city: data.city ? String(data.city) : undefined,
      region: data.region ? String(data.region) : undefined,
      label: data.locationLabel ? String(data.locationLabel) : undefined,
    };
  }

  return undefined;
}

export function mapListing(id: string, data: Record<string, unknown>): Listing {
  const createdAt = data.createdAt;
  const imageUrls = Array.isArray(data.imageUrls)
    ? data.imageUrls.map(String).filter(Boolean)
    : data.imageUrl
      ? [String(data.imageUrl)]
      : [];

  const primaryCategoryId = data.primaryCategoryId
    ? String(data.primaryCategoryId)
    : getDefaultCategoryId();

  return {
    id,
    title: String(data.title ?? ''),
    titleLower: data.titleLower ? String(data.titleLower) : normalizeTitleLower(String(data.title ?? '')),
    description: String(data.description ?? ''),
    price: Number(data.price ?? 0),
    imageUrls,
    imageUrl: String(data.imageUrl ?? imageUrls[0] ?? ''),
    sellerId: String(data.sellerId ?? ''),
    sellerName: String(data.sellerName ?? 'Unknown seller'),
    communityIds: Array.isArray(data.communityIds)
      ? data.communityIds.map(String)
      : [ALL_COMMUNITY_ID],
    primaryCategoryId,
    categoryIds: Array.isArray(data.categoryIds)
      ? data.categoryIds.map(String)
      : [primaryCategoryId],
    location: parseListingLocation(data),
    status: (data.status as Listing['status']) ?? 'active',
    createdAt:
      createdAt && typeof createdAt === 'object' && 'toDate' in createdAt
        ? (createdAt as { toDate: () => Date }).toDate()
        : undefined,
    removedAt:
      data.removedAt && typeof data.removedAt === 'object' && 'toDate' in data.removedAt
        ? (data.removedAt as { toDate: () => Date }).toDate()
        : undefined,
    removedBy: data.removedBy ? String(data.removedBy) : undefined,
  };
}

export function mapFeedEntry(id: string, data: Record<string, unknown>): ListingFeedEntry {
  const listing = mapListing(id, { ...data, id: data.listingId ?? id });
  return {
    ...listing,
    listingId: String(data.listingId ?? id),
    feedCommunityId: String(data.feedCommunityId ?? ALL_COMMUNITY_ID),
  };
}

export function listingWritePayload(
  listing: Omit<Listing, 'id' | 'status' | 'createdAt' | 'imageUrl' | 'titleLower'>,
): Record<string, unknown> {
  const imageUrls = listing.imageUrls.filter(Boolean);
  const primaryCategoryId = listing.primaryCategoryId || getDefaultCategoryId();
  const categoryIds =
    listing.categoryIds.length > 0 ? listing.categoryIds : [primaryCategoryId];

  const payload: Record<string, unknown> = {
    title: listing.title,
    titleLower: normalizeTitleLower(listing.title),
    description: listing.description,
    price: listing.price,
    imageUrls,
    imageUrl: imageUrls[0] ?? '',
    sellerId: listing.sellerId,
    sellerName: listing.sellerName,
    communityIds: listing.communityIds,
    primaryCategoryId,
    categoryIds,
  };

  if (listing.location) {
    payload.location = new GeoPoint(listing.location.lat, listing.location.lng);
    payload.lat = listing.location.lat;
    payload.lng = listing.location.lng;
    payload.geohash =
      listing.location.geohash ?? encodeGeohash({ lat: listing.location.lat, lng: listing.location.lng });
    payload.city = listing.location.city ?? '';
    payload.region = listing.location.region ?? '';
    payload.locationLabel = listing.location.label ?? '';
  }

  return payload;
}

export function feedEntryPayload(
  listing: Listing,
  feedCommunityId: string,
): DocumentData {
  return {
    listingId: listing.id,
    feedCommunityId,
    title: listing.title,
    titleLower: listing.titleLower ?? normalizeTitleLower(listing.title),
    description: listing.description,
    price: listing.price,
    imageUrls: listing.imageUrls,
    imageUrl: listing.imageUrl,
    sellerId: listing.sellerId,
    sellerName: listing.sellerName,
    communityIds: listing.communityIds,
    primaryCategoryId: listing.primaryCategoryId,
    categoryIds: listing.categoryIds,
    status: listing.status,
    createdAt: listing.createdAt ?? null,
    ...(listing.location
      ? {
          location: new GeoPoint(listing.location.lat, listing.location.lng),
          lat: listing.location.lat,
          lng: listing.location.lng,
          geohash:
            listing.location.geohash ??
            encodeGeohash({ lat: listing.location.lat, lng: listing.location.lng }),
          city: listing.location.city ?? '',
          region: listing.location.region ?? '',
          locationLabel: listing.location.label ?? '',
        }
      : {}),
  };
}

/** @deprecated Prefer matchesListingSearchQuery from browseSearchRanking. */
export function matchesListingKeyword(
  listing: Pick<Listing, 'title' | 'sellerName'>,
  query: string,
): boolean {
  return matchesListingSearchQuery(listing, query);
}
