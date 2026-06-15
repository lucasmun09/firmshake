import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { ALL_COMMUNITY_ID } from '@/data/seedCommunities';
import type { Listing } from '@/types';
import { normalizeImageUrl } from '@/utils/apiBaseUrl';
import { db } from './firebase';

function mapListing(id: string, data: Record<string, unknown>): Listing {
  const createdAt = data.createdAt;
  return {
    id,
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    price: Number(data.price ?? 0),
    imageUrl: normalizeImageUrl(String(data.imageUrl ?? '')),
    sellerId: String(data.sellerId ?? ''),
    sellerName: String(data.sellerName ?? 'Unknown seller'),
    communityIds: Array.isArray(data.communityIds)
      ? data.communityIds.map(String)
      : [ALL_COMMUNITY_ID],
    status: (data.status as Listing['status']) ?? 'active',
    createdAt:
      createdAt && typeof createdAt === 'object' && 'toDate' in createdAt
        ? (createdAt as { toDate: () => Date }).toDate()
        : undefined,
  };
}

function matchesCommunity(listing: Listing, communityId?: string): boolean {
  if (!communityId || communityId === ALL_COMMUNITY_ID) {
    return (
      listing.communityIds.includes(ALL_COMMUNITY_ID) ||
      listing.communityIds.length > 0
    );
  }
  return listing.communityIds.includes(communityId);
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

  const listingsQuery = query(
    collection(db, 'listings'),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(
    listingsQuery,
    (snapshot) => {
      const listings = snapshot.docs
        .map((entry) => mapListing(entry.id, entry.data()))
        .filter((listing) => matchesCommunity(listing, communityId));
      onData(listings);
    },
    (error) => onError?.(error),
  );
}

export async function getListingById(id: string): Promise<Listing | null> {
  if (!db) return null;

  const snapshot = await getDoc(doc(db, 'listings', id));
  if (!snapshot.exists()) return null;

  return mapListing(snapshot.id, snapshot.data());
}

export async function createListing(
  listing: Omit<Listing, 'id' | 'status' | 'createdAt'>,
): Promise<Listing> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  const docRef = await addDoc(collection(db, 'listings'), {
    title: listing.title,
    description: listing.description,
    price: listing.price,
    imageUrl: listing.imageUrl,
    sellerId: listing.sellerId,
    sellerName: listing.sellerName,
    communityIds: listing.communityIds,
    status: 'active',
    createdAt: serverTimestamp(),
  });

  return {
    ...listing,
    id: docRef.id,
    status: 'active',
  };
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

  const listingsQuery = query(
    collection(db, 'listings'),
    where('sellerId', '==', sellerId),
    where('status', '==', 'active'),
  );

  return onSnapshot(
    listingsQuery,
    (snapshot) => {
      const listings = snapshot.docs
        .map((entry) => mapListing(entry.id, entry.data()))
        .sort((left, right) => {
          const leftTime = left.createdAt?.getTime() ?? 0;
          const rightTime = right.createdAt?.getTime() ?? 0;
          return rightTime - leftTime;
        });
      onData(listings);
    },
    (error) => onError?.(error),
  );
}
