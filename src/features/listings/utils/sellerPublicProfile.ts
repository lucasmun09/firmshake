import type { Listing } from '@/types';

export type SellerPublicProfile = {
  sellerId: string;
  displayName: string;
  photoUrl?: string;
  activeListingCount: number;
};

/** Derive a guest-safe seller header from active listings (no private profile fields). */
export function sellerProfileFromListings(
  sellerId: string,
  listings: Pick<Listing, 'sellerId' | 'sellerName'>[],
  overrides?: { displayName?: string; photoUrl?: string | null },
): SellerPublicProfile {
  const own = listings.filter((listing) => listing.sellerId === sellerId);
  const fromListing = own.find((listing) => listing.sellerName.trim())?.sellerName.trim();
  const displayName =
    overrides?.displayName?.trim()
    || fromListing
    || 'FirmShake User';

  const photoUrl = overrides?.photoUrl?.trim() || undefined;

  return {
    sellerId,
    displayName,
    photoUrl,
    activeListingCount: own.length,
  };
}
