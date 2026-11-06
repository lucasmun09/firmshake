import { getListingById } from '@/features/listings/services/listings';
import { removeListingFromAllBrowseLocalCaches } from '@/features/listings/services/browseLocalStorageCache';
import type { Listing } from '@/types';

export function isListingAvailableForBrowse(status: Listing['status']): boolean {
  return status === 'active';
}

export async function fetchListingStatus(listingId: string): Promise<Listing['status'] | null> {
  const listing = await getListingById(listingId, { preferCache: true, preferServer: true });
  return listing?.status ?? null;
}

/** Bust browse caches and return true when the listing is still available. */
export async function validateListingAvailability(listingId: string): Promise<boolean> {
  const status = await fetchListingStatus(listingId);
  if (status != null && isListingAvailableForBrowse(status)) {
    return true;
  }

  removeListingFromAllBrowseLocalCaches(listingId);
  return false;
}
