import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  where,
  writeBatch,
  type DocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';

import { ALL_COMMUNITY_ID } from '@/features/communities/data/seedCommunities';
import type { Listing } from '@/types';
import {
  feedEntryPayload,
  LISTINGS_PAGE_SIZE,
  mapFeedEntry,
  mapListing,
} from '@/features/listings/utils/listingMapper';
import { primaryListingImageUrl } from '@/features/listings/utils/listingImages';
import { db } from '@/common/services/firebase';

export interface FeedPageOptions {
  pageSize?: number;
  startAfterDoc?: DocumentSnapshot | null;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface FeedPageResult {
  listings: Listing[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}

function feedCollection(communityId: string) {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  return collection(db, 'communityFeeds', communityId, 'listings');
}

function feedTargetsForListing(listing: Pick<Listing, 'communityIds'>): string[] {
  const ids = new Set<string>([ALL_COMMUNITY_ID]);
  for (const communityId of listing.communityIds) {
    ids.add(communityId);
  }
  return [...ids];
}

export async function fetchBrowsePage(
  communityId: string,
  options: FeedPageOptions = {},
): Promise<FeedPageResult> {
  try {
    const feedPage = await fetchCommunityFeedPage(communityId, options);
    if (feedPage.listings.length > 0 || options.startAfterDoc) {
      return feedPage;
    }
  } catch (error) {
    console.warn('Community feed query failed, falling back to listings collection', error);
  }

  return fetchListingsPageByCommunity(communityId, options);
}

export async function fetchCommunityFeedPage(
  communityId: string,
  options: FeedPageOptions = {},
): Promise<FeedPageResult> {
  if (!db) {
    return { listings: [], lastDoc: null, hasMore: false };
  }

  const pageSize = options.pageSize ?? LISTINGS_PAGE_SIZE;
  const constraints: QueryConstraint[] = [
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1),
  ];

  if (options.categoryId) {
    constraints.unshift(where('primaryCategoryId', '==', options.categoryId));
  }

  if (options.minPrice != null) {
    constraints.unshift(where('price', '>=', options.minPrice));
  }

  if (options.maxPrice != null) {
    constraints.unshift(where('price', '<=', options.maxPrice));
  }

  if (options.startAfterDoc) {
    constraints.push(startAfter(options.startAfterDoc));
  }

  const snapshot = await getDocs(query(feedCollection(communityId), ...constraints));
  const docs = snapshot.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;

  const listings = pageDocs.map((entry) =>
    mapFeedEntry(entry.id, entry.data() as Record<string, unknown>),
  );

  return {
    listings,
    lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
    hasMore,
  };
}

/** Legacy paginated query on listings collection (array-contains community). */
export async function fetchListingsPageByCommunity(
  communityId: string,
  options: FeedPageOptions = {},
): Promise<FeedPageResult> {
  if (!db) {
    return { listings: [], lastDoc: null, hasMore: false };
  }

  const pageSize = options.pageSize ?? LISTINGS_PAGE_SIZE;
  const constraints: QueryConstraint[] = [
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1),
  ];

  if (communityId && communityId !== ALL_COMMUNITY_ID) {
    constraints.unshift(where('communityIds', 'array-contains', communityId));
  }

  if (options.categoryId) {
    constraints.unshift(where('primaryCategoryId', '==', options.categoryId));
  }

  if (options.startAfterDoc) {
    constraints.push(startAfter(options.startAfterDoc));
  }

  try {
    const snapshot = await getDocs(query(collection(db, 'listings'), ...constraints));
    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;
    const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;

    return {
      listings: pageDocs.map((entry) => mapListing(entry.id, entry.data() as Record<string, unknown>)),
      lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
      hasMore,
    };
  } catch (error) {
    console.warn('Paginated listings query failed, using simple active query', error);

    const snapshot = await getDocs(
      query(
        collection(db, 'listings'),
        where('status', '==', 'active'),
        limit(pageSize + 1),
      ),
    );

    let listings = snapshot.docs.map((entry) =>
      mapListing(entry.id, entry.data() as Record<string, unknown>),
    );

    if (communityId && communityId !== ALL_COMMUNITY_ID) {
      listings = listings.filter((listing) => listing.communityIds.includes(communityId));
    }

    if (options.categoryId) {
      listings = listings.filter((listing) => listing.primaryCategoryId === options.categoryId);
    }

    listings.sort((left, right) => (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0));

    const hasMore = listings.length > pageSize;
    const pageListings = hasMore ? listings.slice(0, pageSize) : listings;

    return {
      listings: pageListings,
      lastDoc: null,
      hasMore,
    };
  }
}

export async function syncListingFeeds(
  listing: Listing,
  previousCommunityIds?: string[],
): Promise<void> {
  if (!db) {
    return;
  }

  const nextTargets = new Set(feedTargetsForListing(listing));
  const previousTargets = previousCommunityIds
    ? feedTargetsForListing({ communityIds: previousCommunityIds })
    : [];

  const toRemove = previousTargets.filter((id) => !nextTargets.has(id));
  const batch = writeBatch(db);

  for (const feedCommunityId of nextTargets) {
    const payload = feedEntryPayload(listing, feedCommunityId);
    batch.set(doc(db, 'communityFeeds', feedCommunityId, 'listings', listing.id), payload, {
      merge: true,
    });
  }

  for (const feedCommunityId of toRemove) {
    batch.delete(doc(db, 'communityFeeds', feedCommunityId, 'listings', listing.id));
  }

  await batch.commit();
}

export async function updateListingFeedStatus(
  listingId: string,
  status: Listing['status'],
  communityIds: string[],
): Promise<void> {
  if (!db) {
    return;
  }

  const batch = writeBatch(db);
  for (const feedCommunityId of feedTargetsForListing({ communityIds })) {
    batch.set(
      doc(db, 'communityFeeds', feedCommunityId, 'listings', listingId),
      { status, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }
  await batch.commit();
}

export async function removeListingFromFeeds(
  listingId: string,
  communityIds: string[],
): Promise<void> {
  if (!db) {
    return;
  }

  await Promise.all(
    feedTargetsForListing({ communityIds }).map((feedCommunityId) =>
      deleteDoc(doc(db!, 'communityFeeds', feedCommunityId, 'listings', listingId)),
    ),
  );
}

export function listingFromCreatePayload(
  id: string,
  listing: Omit<Listing, 'id' | 'status' | 'createdAt' | 'imageUrl' | 'titleLower'>,
): Listing {
  const imageUrls = listing.imageUrls.filter(Boolean);
  return {
    ...listing,
    id,
    imageUrls,
    imageUrl: primaryListingImageUrl(imageUrls),
    status: 'active',
    createdAt: new Date(),
  };
}
