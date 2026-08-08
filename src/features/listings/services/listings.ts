import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocFromCache,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
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
  withTransientFirestoreRetry,
} from '@/common/services/firestoreAuth';
import { auth } from '@/common/services/firebase';
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
  options?: { preferCache?: boolean; preferServer?: boolean },
): Promise<Listing | null> {
  const listings = await getListingsByIds([id], options);
  return listings.get(id) ?? null;
}

const LISTING_BATCH_SIZE = 30;

export async function getListingsByIds(
  ids: string[],
  options?: { preferCache?: boolean; preferServer?: boolean },
): Promise<Map<string, Listing>> {
  const result = new Map<string, Listing>();
  if (!db || ids.length === 0) {
    debugLog.warn('listing', 'getListingsByIds skipped: missing db or empty ids', {
      hasDb: Boolean(db),
      idCount: ids.length,
    });
    return result;
  }

  const uniqueIds = [...new Set(ids)];
  const uncachedIds: string[] = [];
  const negativeCacheIds: string[] = [];

  if (options?.preferCache) {
    for (const id of uniqueIds) {
      try {
        const cached = await getDocFromCache(doc(db, 'listings', id));
        if (cached.exists()) {
          result.set(id, mapListing(cached.id, cached.data() as Record<string, unknown>));
        } else {
          uncachedIds.push(id);
          negativeCacheIds.push(id);
        }
      } catch {
        uncachedIds.push(id);
      }
    }
  } else {
    uncachedIds.push(...uniqueIds);
  }

  if (uncachedIds.length === 0) {
    debugLog.debug('listing', 'getListingsByIds satisfied from cache', {
      ids: uniqueIds,
      count: result.size,
    });
    return result;
  }

  const firestore = db;
  if (!firestore) {
    return result;
  }

  const preferServer = options?.preferServer ?? false;
  const readContext = 'getListingsByIds';

  const readSingleListing = async (id: string) => {
    const readDoc = preferServer || negativeCacheIds.includes(id) ? getDocFromServer : getDoc;
    const snapshot = await readDoc(doc(firestore, 'listings', id));
    if (snapshot.exists()) {
      result.set(snapshot.id, mapListing(snapshot.id, snapshot.data() as Record<string, unknown>));
      return;
    }

    debugLog.warn('listing', 'Listing document missing on Firestore read', {
      id,
      source: preferServer || negativeCacheIds.includes(id) ? 'server' : 'default',
    });
  };

  const readListingBatch = async (batch: string[]) => {
    const listingsQuery = query(collection(firestore, 'listings'), where(documentId(), 'in', batch));
    const readQuery = preferServer || batch.some((id) => negativeCacheIds.includes(id))
      ? getDocsFromServer
      : getDocs;
    const snapshot = await readQuery(listingsQuery);

    for (const entry of snapshot.docs) {
      result.set(entry.id, mapListing(entry.id, entry.data() as Record<string, unknown>));
    }

    for (const id of batch) {
      if (!result.has(id)) {
        debugLog.warn('listing', 'Listing document missing from batch Firestore read', {
          id,
          source: preferServer || negativeCacheIds.includes(id) ? 'server' : 'default',
        });
      }
    }
  };

  try {
    if (uncachedIds.length === 1) {
      await withTransientFirestoreRetry(
        () => readSingleListing(uncachedIds[0]!),
        { user: auth?.currentUser ?? null, context: readContext },
      );
      return result;
    }

    const batches: string[][] = [];
    for (let index = 0; index < uncachedIds.length; index += LISTING_BATCH_SIZE) {
      batches.push(uncachedIds.slice(index, index + LISTING_BATCH_SIZE));
    }

    await Promise.all(
      batches.map((batch) =>
        withTransientFirestoreRetry(
          () => readListingBatch(batch),
          { user: auth?.currentUser ?? null, context: readContext },
        ),
      ),
    );
  } catch (error) {
    debugLog.error('listing', 'getListingsByIds failed', {
      ids: uncachedIds,
      preferCache: options?.preferCache ?? false,
      preferServer,
      negativeCacheIds,
      error: serializeError(error),
    });
    throw error;
  }

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
