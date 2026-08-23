import type { Listing, ListingSummary } from '@/types';

/** Full listing document — detail page, create/edit, messaging. */
export type { ListingDetail } from '@/types';
export type { ListingSummary };

const SUMMARY_DEFAULTS: Pick<
  Listing,
  'description' | 'imageUrls' | 'sellerName' | 'categoryIds' | 'titleLower'
> = {
  description: '',
  imageUrls: [],
  sellerName: '',
  categoryIds: [],
  titleLower: '',
};

export function toListingSummary(listing: Listing): ListingSummary {
  return {
    id: listing.id,
    title: listing.title,
    price: listing.price,
    imageUrl: listing.imageUrl || listing.imageUrls[0] || '',
    status: listing.status,
    sellerId: listing.sellerId,
    communityIds: listing.communityIds,
    primaryCategoryId: listing.primaryCategoryId,
    location: listing.location,
    createdAt: listing.createdAt,
  };
}

export function summarizeListings(listings: Listing[]): ListingSummary[] {
  return listings.map(toListingSummary);
}

/** Revive a cached summary into a Listing with empty detail defaults. */
export function listingSummaryToListing(summary: ListingSummary): Listing {
  return {
    ...SUMMARY_DEFAULTS,
    ...summary,
    titleLower: summary.title.trim().toLowerCase(),
    imageUrls: summary.imageUrl ? [summary.imageUrl] : [],
    categoryIds: [summary.primaryCategoryId],
    sellerName: 'Unknown seller',
  };
}

export function summariesToListings(summaries: ListingSummary[]): Listing[] {
  return summaries.map(listingSummaryToListing);
}
