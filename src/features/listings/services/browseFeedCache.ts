import type { DocumentSnapshot } from 'firebase/firestore';

import type { FeedPageResult } from '@/features/listings/services/listingFeed';
import {
  buildUserCacheKey,
  getCached,
  getStaleCached,
  invalidateCached,
  invalidateCachedNamespace,
  setCached,
} from '@/common/services/responseCache';
import type { Listing } from '@/types';

const BROWSE_NAMESPACE = 'browse-feed';

interface StoredBrowsePage {
  listings: Listing[];
  hasMore: boolean;
}

export interface CachedBrowsePage {
  listings: Listing[];
  hasMore: boolean;
  lastDoc: DocumentSnapshot | null;
}

function reviveListing(listing: Listing): Listing {
  const createdAt =
    listing.createdAt instanceof Date
      ? listing.createdAt
      : listing.createdAt
        ? new Date(listing.createdAt as unknown as string)
        : undefined;

  return {
    ...listing,
    createdAt,
  };
}

function toStoredPage(page: FeedPageResult): StoredBrowsePage {
  return {
    listings: page.listings,
    hasMore: page.hasMore,
  };
}

export function browseFeedCacheKey(
  uid: string,
  communityId: string,
  categoryId?: string,
): string {
  return buildUserCacheKey(uid, BROWSE_NAMESPACE, {
    tab: 'browse',
    community: communityId,
    category: categoryId ?? '',
  });
}

export function getCachedBrowsePage(key: string): CachedBrowsePage | null {
  const fresh = getCached<StoredBrowsePage>(key);
  if (!fresh) {
    return null;
  }

  return {
    listings: fresh.listings.map(reviveListing),
    hasMore: fresh.hasMore,
    lastDoc: null,
  };
}

export function getStaleBrowsePage(key: string): CachedBrowsePage | null {
  const stale = getStaleCached<StoredBrowsePage>(key);
  if (!stale) {
    return null;
  }

  return {
    listings: stale.listings.map(reviveListing),
    hasMore: stale.hasMore,
    lastDoc: null,
  };
}

export function setCachedBrowsePage(key: string, page: FeedPageResult): void {
  setCached(key, toStoredPage(page));
}

export function invalidateBrowseFeedCache(key: string): void {
  invalidateCached(key);
}

export function invalidateAllBrowseFeedCache(): void {
  invalidateCachedNamespace(BROWSE_NAMESPACE);
}
