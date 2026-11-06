import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

import { db } from '@/common/services/firebase';
import { ensureFirestoreAuth } from '@/common/services/firestoreAuth';
import { getListingsByIds } from '@/features/listings/services/listings';
import { groupMessagesByBuyer } from '@/features/listings/utils/listingConversations';
import {
  fetchListingMessages,
  getMessageAccessOptions,
} from '@/features/messages/services/messages';
import { writeSellerConversationThread, syncMessageThreadForUser } from '@/features/messages/services/threadSync';

const REBUILD_CONCURRENCY = 5;

async function collectListingIdsForUser(userId: string): Promise<Set<string>> {
  const listingIds = new Set<string>();

  if (!db) {
    return listingIds;
  }

  const [notificationSnapshot, sellerListingsSnapshot, messageListingsSnapshot] =
    await Promise.all([
      getDocs(
        query(collection(db, 'users', userId, 'notifications'), where('recipientId', '==', userId)),
      ),
      getDocs(
        query(
          collection(db, 'listings'),
          where('sellerId', '==', userId),
          where('status', '==', 'active'),
        ),
      ),
      getDocs(collection(db, 'users', userId, 'messageListings')),
    ]);

  for (const entry of notificationSnapshot.docs) {
    const listingId = entry.data().listingId;
    if (listingId) {
      listingIds.add(String(listingId));
    }
  }

  for (const entry of sellerListingsSnapshot.docs) {
    listingIds.add(entry.id);
  }

  for (const entry of messageListingsSnapshot.docs) {
    listingIds.add(entry.id);
  }

  return listingIds;
}

async function rebuildListingThreads(
  userId: string,
  listingId: string,
): Promise<void> {
  const listingsById = await getListingsByIds([listingId], { preferCache: true });
  const listing = listingsById.get(listingId);
  if (!listing) {
    return;
  }

  const messages = await fetchListingMessages(
    listingId,
    {
      ...getMessageAccessOptions(listing, userId),
      preferCache: true,
    },
  );

  if (listing.sellerId === userId) {
    const conversations = groupMessagesByBuyer(messages, userId);
    await Promise.all(
      conversations.map((conversation) =>
        writeSellerConversationThread(userId, listing, conversation, userId),
      ),
    );
    return;
  }

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) {
    return;
  }

  await syncMessageThreadForUser(userId, listing, lastMessage);
}

/** Bounded parallel map used by thread rebuild (exported for unit tests). */
export async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await mapper(items[currentIndex]!);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

export async function rebuildThreadsForUser(userId: string): Promise<void> {
  if (!db) {
    return;
  }

  await ensureFirestoreAuth();

  const listingIds = await collectListingIdsForUser(userId);

  await mapWithConcurrency(
    [...listingIds],
    REBUILD_CONCURRENCY,
    (listingId) => rebuildListingThreads(userId, listingId),
  );
}
