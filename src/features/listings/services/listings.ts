import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocFromCache,
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { getDefaultCategoryId } from '@/features/listings/data/seedCategories';
import type { Listing, UserProfile } from '@/types';
import { mapListing } from '@/features/listings/utils/listingMapper';
import { fetchBrowsePage } from '@/features/listings/services/listingFeed';
import {
  routeCreateListing,
  routeRemoveListing,
  routeUpdateListing,
  shouldRouteListingsViaBff,
} from '@/features/listings/services/listingServiceRouter';
import { db } from '@/common/services/firebase';
import {
  attachRetriableSnapshot,
  createFirestoreSnapshotErrorHandler,
  ensureFirestoreAuth,
  isSessionExpiredError,
  SessionExpiredError,
} from '@/common/services/firestoreAuth';
import { debugLog, serializeError } from '@/common/debug/debugLog';

export { LISTINGS_PAGE_SIZE } from '@/features/listings/utils/listingMapper';
export type { FeedPageOptions, FeedPageResult } from '@/features/listings/services/listingFeed';

async function browsePageWithFallback(
  communityId: string,
  options: Parameters<typeof fetchBrowsePage>[1] = {},
) {
  return fetchBrowsePage(communityId, options);
}

export function subscribeListings(
  communityId: string | undefined,
  onData: (listings: Listing[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!db) {
    onData([]);
    return () => undefined;
  }

  let cancelled = false;

  void browsePageWithFallback(communityId ?? 'all')
    .then((page) => {
      if (!cancelled) {
        onData(page.listings);
      }
    })
    .catch((error) => {
      if (!cancelled) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    });

  return () => {
    cancelled = true;
  };
}

export async function loadMoreListings(
  communityId: string,
  startAfterDoc: NonNullable<Parameters<typeof fetchBrowsePage>[1]>['startAfterDoc'],
  options?: Omit<Parameters<typeof fetchBrowsePage>[1], 'startAfterDoc'>,
) {
  return browsePageWithFallback(communityId, { ...options, startAfterDoc });
}

export async function getListingById(
  id: string,
  options?: { preferCache?: boolean },
): Promise<Listing | null> {
  const listings = await getListingsByIds([id], options);
  return listings.get(id) ?? null;
}

const LISTING_BATCH_SIZE = 30;

export async function getListingsByIds(
  ids: string[],
  options?: { preferCache?: boolean },
): Promise<Map<string, Listing>> {
  const result = new Map<string, Listing>();
  if (!db || ids.length === 0) {
    return result;
  }

  const uniqueIds = [...new Set(ids)];
  const uncachedIds: string[] = [];

  if (options?.preferCache) {
    for (const id of uniqueIds) {
      try {
        const cached = await getDocFromCache(doc(db, 'listings', id));
        if (cached.exists()) {
          result.set(id, mapListing(cached.id, cached.data() as Record<string, unknown>));
        } else {
          uncachedIds.push(id);
        }
      } catch {
        uncachedIds.push(id);
      }
    }
  } else {
    uncachedIds.push(...uniqueIds);
  }

  if (uncachedIds.length === 0) {
    return result;
  }

  const batches: string[][] = [];
  for (let index = 0; index < uncachedIds.length; index += LISTING_BATCH_SIZE) {
    batches.push(uncachedIds.slice(index, index + LISTING_BATCH_SIZE));
  }

  await Promise.all(
    batches.map(async (batch) => {
      const firestore = db;
      if (!firestore) {
        return;
      }

      const snapshot = await getDocs(
        query(collection(firestore, 'listings'), where(documentId(), 'in', batch)),
      );

      for (const entry of snapshot.docs) {
        result.set(entry.id, mapListing(entry.id, entry.data() as Record<string, unknown>));
      }
    }),
  );

  return result;
}

export async function createListing(
  listing: Omit<
    Listing,
    'id' | 'status' | 'createdAt' | 'imageUrl' | 'titleLower' | 'primaryCategoryId' | 'categoryIds'
  > & {
    primaryCategoryId?: string;
    categoryIds?: string[];
  },
): Promise<Listing> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  const primaryCategoryId = listing.primaryCategoryId || getDefaultCategoryId();
  const categoryIds =
    listing.categoryIds && listing.categoryIds.length > 0
      ? listing.categoryIds
      : [primaryCategoryId];

  debugLog.info('listing', 'Creating listing', {
    title: listing.title,
    price: listing.price,
    communityIds: listing.communityIds,
    primaryCategoryId,
    viaBff: shouldRouteListingsViaBff(),
  });

  const created = await routeCreateListing({
    ...listing,
    primaryCategoryId,
    categoryIds,
  });

  if (shouldRouteListingsViaBff()) {
    debugLog.info('listing', 'Listing created via BFF', { listingId: created.id, title: created.title });
  }

  return created;
}

export async function updateListing(
  listingId: string,
  listing: Omit<
    Listing,
    | 'id'
    | 'status'
    | 'createdAt'
    | 'imageUrl'
    | 'sellerId'
    | 'sellerName'
    | 'titleLower'
    | 'primaryCategoryId'
    | 'categoryIds'
    | 'location'
  > & {
    primaryCategoryId?: string;
    categoryIds?: string[];
    location?: Listing['location'];
  },
): Promise<Listing> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  return routeUpdateListing(listingId, listing);
}

export async function removeListing(
  listingId: string,
  actor: UserProfile,
): Promise<Listing> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  return routeRemoveListing(listingId, actor);
}

export function subscribeSellerListings(
  sellerId: string,
  onData: (listings: Listing[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!db) {
    onData([]);
    return () => undefined;
  }

  let cancelled = false;
  let snapshotUnsub: Unsubscribe | undefined;

  const listingsQuery = query(
    collection(db, 'listings'),
    where('sellerId', '==', sellerId),
    where('status', '==', 'active'),
  );

  void ensureFirestoreAuth()
    .then(() => {
      if (cancelled || !db) {
        return;
      }

      debugLog.debug('listing', 'subscribeSellerListings: Firestore auth ready', { sellerId });

      snapshotUnsub = attachRetriableSnapshot(
        (onSnapshotError) => onSnapshot(
          listingsQuery,
          (snapshot) => {
            const listings = snapshot.docs
              .map((entry) => mapListing(entry.id, entry.data() as Record<string, unknown>))
              .sort((left, right) => {
                const leftTime = left.createdAt?.getTime() ?? 0;
                const rightTime = right.createdAt?.getTime() ?? 0;
                return rightTime - leftTime;
              });
            debugLog.debug('listing', 'Seller listings snapshot', {
              sellerId,
              count: listings.length,
            });
            onData(listings);
          },
          createFirestoreSnapshotErrorHandler(onSnapshotError, 'subscribeSellerListings'),
        ),
        onError,
        'subscribeSellerListings',
      );
    })
    .catch((error) => {
      if (isSessionExpiredError(error)) {
        onError?.(error instanceof Error ? error : new SessionExpiredError());
        return;
      }
      debugLog.warn('listing', 'subscribeSellerListings: ensureFirestoreAuth failed', {
        sellerId,
        error: serializeError(error),
      });
      onError?.(error instanceof Error ? error : new Error(String(error)));
    });

  return () => {
    cancelled = true;
    snapshotUnsub?.();
  };
}
