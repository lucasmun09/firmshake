import type { Listing } from '@/types';
import type { BrowseMapPinGroup, BrowseMapPinGroupSummary } from '@/features/listings/utils/browseMapPinAggregation';

/** Normalize blocked seller ids for O(1) membership checks. */
export function toBlockedSellerIdSet(
  blockedSellerIds: Iterable<string> | null | undefined,
): Set<string> {
  const set = new Set<string>();
  if (!blockedSellerIds) {
    return set;
  }
  for (const id of blockedSellerIds) {
    const trimmed = String(id ?? '').trim();
    if (trimmed) {
      set.add(trimmed);
    }
  }
  return set;
}

/**
 * Drop browse rows whose seller is on the viewer block list.
 * Used for local/cache paint after a fresh block (Bearer BFF filtering covers live fetches).
 */
export function excludeListingsByBlockedSellers<T extends { sellerId?: string | null }>(
  listings: T[],
  blockedSellerIds: Iterable<string> | null | undefined,
): T[] {
  const blocked = toBlockedSellerIdSet(blockedSellerIds);
  if (blocked.size === 0) {
    return listings;
  }
  return listings.filter((listing) => {
    const sellerId = listing.sellerId ? String(listing.sellerId) : '';
    return !sellerId || !blocked.has(sellerId);
  });
}

/** Same filter for hydrated map pin groups (per-seller pins). */
export function excludePinGroupsByBlockedSellers<
  T extends BrowseMapPinGroup | BrowseMapPinGroupSummary,
>(pinGroups: T[], blockedSellerIds: Iterable<string> | null | undefined): T[] {
  const blocked = toBlockedSellerIdSet(blockedSellerIds);
  if (blocked.size === 0) {
    return pinGroups;
  }
  return pinGroups.filter((group) => !blocked.has(group.sellerId));
}

/** Convenience: listings + optional pinGroups in one pass. */
export function applyBrowseBlockListFilter<TListing extends { sellerId?: string | null }>(
  input: {
    listings: TListing[];
    pinGroups?: BrowseMapPinGroup[];
  },
  blockedSellerIds: Iterable<string> | null | undefined,
): { listings: TListing[]; pinGroups?: BrowseMapPinGroup[] } {
  const listings = excludeListingsByBlockedSellers(input.listings, blockedSellerIds);
  if (!input.pinGroups) {
    return { listings };
  }
  return {
    listings,
    pinGroups: excludePinGroupsByBlockedSellers(input.pinGroups, blockedSellerIds),
  };
}

/** Type guard helper for Listing[] callers. */
export function filterBrowseListingsForBlockedSellers(
  listings: Listing[],
  blockedSellerIds: Iterable<string> | null | undefined,
): Listing[] {
  return excludeListingsByBlockedSellers(listings, blockedSellerIds);
}
