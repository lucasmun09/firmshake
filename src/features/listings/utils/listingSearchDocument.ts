import type { Listing } from '@/types';

/** Document shape synced to Typesense / search API. */
export interface ListingSearchDocument {
  id: string;
  title: string;
  description: string;
  communityIds: string[];
  primaryCategoryId: string;
  categoryIds: string[];
  price: number;
  status: string;
  sellerId: string;
  sellerName: string;
  imageUrl: string;
  createdAt: number;
  location?: [number, number];
  geohash?: string;
  city?: string;
  region?: string;
}

export function buildListingSearchDocument(listing: Listing): ListingSearchDocument {
  const doc: ListingSearchDocument = {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    communityIds: listing.communityIds,
    primaryCategoryId: listing.primaryCategoryId,
    categoryIds: listing.categoryIds,
    price: listing.price,
    status: listing.status,
    sellerId: listing.sellerId,
    sellerName: listing.sellerName,
    imageUrl: listing.imageUrl,
    createdAt: listing.createdAt?.getTime() ?? Date.now(),
  };

  if (listing.location) {
    doc.location = [listing.location.lat, listing.location.lng];
    doc.geohash = listing.location.geohash;
    doc.city = listing.location.city;
    doc.region = listing.location.region;
  }

  return doc;
}
