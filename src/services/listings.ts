import type { Listing } from '@/types';
import { mockListings } from '@/data/mockListings';

const listings = [...mockListings];

export function getListings(communityId?: string): Listing[] {
  if (!communityId || communityId === 'all') {
    return listings.filter(
      (listing) =>
        listing.communityIds.includes('all') || listing.communityIds.length > 0,
    );
  }

  return listings.filter((listing) => listing.communityIds.includes(communityId));
}

export function getListingById(id: string): Listing | undefined {
  return listings.find((listing) => listing.id === id);
}

export function addListing(listing: Omit<Listing, 'id'>): Listing {
  const newListing: Listing = {
    ...listing,
    id: String(Date.now()),
  };
  listings.unshift(newListing);
  return newListing;
}
