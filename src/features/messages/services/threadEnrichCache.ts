import type { Listing } from '@/types';

/** Fields enrichThreads needs from a listing document. */
export type ThreadEnrichListingFields = Pick<
  Listing,
  'id' | 'title' | 'imageUrl' | 'sellerId' | 'sellerName' | 'status'
>;

export const THREAD_ENRICH_CACHE_TTL_MS = 60_000;
export const THREAD_ENRICH_CACHE_MAX = 200;

interface CacheEntry {
  data: ThreadEnrichListingFields;
  expiresAt: number;
}

const memory = new Map<string, CacheEntry>();

function isFresh(entry: CacheEntry, now = Date.now()): boolean {
  return entry.expiresAt > now;
}

function evictExpired(now = Date.now()): void {
  for (const [id, entry] of memory) {
    if (!isFresh(entry, now)) {
      memory.delete(id);
    }
  }
}

function evictOverflow(): void {
  while (memory.size > THREAD_ENRICH_CACHE_MAX) {
    const oldest = memory.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    memory.delete(oldest);
  }
}

export function getThreadEnrichListing(listingId: string): ThreadEnrichListingFields | null {
  const entry = memory.get(listingId);
  if (!entry) {
    return null;
  }
  if (!isFresh(entry)) {
    memory.delete(listingId);
    return null;
  }
  return entry.data;
}

export function getThreadEnrichListings(
  listingIds: string[],
): Map<string, ThreadEnrichListingFields> {
  const found = new Map<string, ThreadEnrichListingFields>();
  for (const id of listingIds) {
    const hit = getThreadEnrichListing(id);
    if (hit) {
      found.set(id, hit);
    }
  }
  return found;
}

export function setThreadEnrichListing(listing: ThreadEnrichListingFields): void {
  if (!listing.id) {
    return;
  }
  memory.delete(listing.id);
  memory.set(listing.id, {
    data: {
      id: listing.id,
      title: listing.title,
      imageUrl: listing.imageUrl,
      sellerId: listing.sellerId,
      sellerName: listing.sellerName,
      status: listing.status,
    },
    expiresAt: Date.now() + THREAD_ENRICH_CACHE_TTL_MS,
  });
  evictOverflow();
}

export function setThreadEnrichListings(listings: ThreadEnrichListingFields[]): void {
  for (const listing of listings) {
    setThreadEnrichListing(listing);
  }
}

export function clearThreadEnrichCache(): void {
  memory.clear();
}

/** Test helper — current size after optional expiry sweep. */
export function threadEnrichCacheSize(): number {
  evictExpired();
  return memory.size;
}
