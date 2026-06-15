import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import type { AppNotification, Listing, Message, MessageThread } from '@/types';
import { normalizeImageUrl } from '@/utils/apiBaseUrl';
import { auth, db } from './firebase';
import { ensureFirestoreAuth } from './firestoreAuth';
import { getListingById } from './listings';
import { fetchListingMessages, getMessageAccessOptions } from './messages';
import { subscribeNotifications } from './notifications';

function mapThread(id: string, data: Record<string, unknown>): MessageThread {
  const lastMessageAt = data.lastMessageAt;
  return {
    id,
    listingId: String(data.listingId ?? id),
    listingTitle: String(data.listingTitle ?? 'Listing'),
    listingImageUrl: normalizeImageUrl(String(data.listingImageUrl ?? '')),
    sellerId: String(data.sellerId ?? ''),
    sellerName: String(data.sellerName ?? 'Seller'),
    lastMessageText: String(data.lastMessageText ?? ''),
    lastMessageSenderId: String(data.lastMessageSenderId ?? ''),
    lastMessageSenderName: String(data.lastMessageSenderName ?? ''),
    lastMessageAt:
      lastMessageAt && typeof lastMessageAt === 'object' && 'toDate' in lastMessageAt
        ? (lastMessageAt as { toDate: () => Date }).toDate()
        : undefined,
  };
}

async function enrichThread(thread: MessageThread): Promise<MessageThread> {
  if (thread.sellerId && thread.listingImageUrl) {
    return thread;
  }

  const listing = await getListingById(thread.listingId);
  if (!listing) {
    return thread;
  }

  return {
    ...thread,
    listingTitle: listing.title,
    listingImageUrl: listing.imageUrl,
    sellerId: listing.sellerId,
    sellerName: listing.sellerName,
  };
}

async function enrichThreads(threads: MessageThread[]): Promise<MessageThread[]> {
  return Promise.all(threads.map((thread) => enrichThread(thread)));
}

function sortThreads(threads: MessageThread[]): MessageThread[] {
  return [...threads].sort((left, right) => {
    const leftTime = left.lastMessageAt?.getTime() ?? 0;
    const rightTime = right.lastMessageAt?.getTime() ?? 0;
    return rightTime - leftTime;
  });
}

function threadFromNotification(notification: AppNotification): MessageThread | null {
  if (!notification.listingId || notification.type !== 'message') {
    return null;
  }

  const bodyParts = notification.body.split(': ');
  const listingTitle = bodyParts.length > 1 ? bodyParts[0] : 'Listing';
  const lastMessageText = bodyParts.length > 1 ? bodyParts.slice(1).join(': ') : notification.body;
  const senderName = notification.title.replace(/ messaged you$/, '');

  return {
    id: notification.listingId,
    listingId: notification.listingId,
    listingTitle,
    listingImageUrl: '',
    sellerId: '',
    sellerName: '',
    lastMessageText,
    lastMessageSenderId: notification.actorId,
    lastMessageSenderName: senderName,
    lastMessageAt: notification.createdAt,
  };
}

function mergeThreads(
  storedThreads: MessageThread[],
  notifications: AppNotification[],
): MessageThread[] {
  const merged = new Map<string, MessageThread>();

  for (const thread of storedThreads) {
    merged.set(thread.listingId, thread);
  }

  for (const notification of notifications) {
    const fallback = threadFromNotification(notification);
    if (!fallback) {
      continue;
    }

    const existing = merged.get(fallback.listingId);
    if (!existing) {
      merged.set(fallback.listingId, fallback);
      continue;
    }

    const existingTime = existing.lastMessageAt?.getTime() ?? 0;
    const fallbackTime = fallback.lastMessageAt?.getTime() ?? 0;
    if (fallbackTime > existingTime) {
      merged.set(fallback.listingId, {
        ...existing,
        lastMessageText: fallback.lastMessageText,
        lastMessageSenderId: fallback.lastMessageSenderId,
        lastMessageSenderName: fallback.lastMessageSenderName,
        lastMessageAt: fallback.lastMessageAt,
      });
    }
  }

  return sortThreads([...merged.values()]);
}

async function getConversationParticipantIds(
  listing: Listing,
  message: Message,
): Promise<string[]> {
  const participants = new Set([listing.sellerId, message.senderId]);

  if (message.recipientId) {
    participants.add(message.recipientId);
  }

  return [...participants];
}

async function writeThreadForUser(
  userId: string,
  listing: Listing,
  message: Message,
  updatedBy: string,
): Promise<void> {
  if (!db) {
    return;
  }

  await setDoc(
    doc(db, 'users', userId, 'threads', listing.id),
    {
      listingId: listing.id,
      listingTitle: listing.title,
      listingImageUrl: listing.imageUrl,
      sellerId: listing.sellerId,
      sellerName: listing.sellerName,
      lastMessageText: message.text,
      lastMessageSenderId: message.senderId,
      lastMessageSenderName: message.senderName,
      lastMessageAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      updatedBy,
    },
    { merge: true },
  );
}

async function writeMessageListingForUser(userId: string, listingId: string): Promise<void> {
  if (!db) {
    return;
  }

  await setDoc(
    doc(db, 'users', userId, 'messageListings', listingId),
    {
      listingId,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );
}

export async function syncMessageThreads(
  listing: Listing,
  message: Message,
): Promise<void> {
  if (!db || !auth?.currentUser) {
    return;
  }

  await ensureFirestoreAuth();

  const updatedBy = auth.currentUser.uid;
  const participantIds = await getConversationParticipantIds(listing, message);

  await Promise.all(
    participantIds.map((userId) => writeThreadForUser(userId, listing, message, updatedBy)),
  );

  await writeMessageListingForUser(updatedBy, listing.id);
}

export async function syncMessageThreadForUser(
  userId: string,
  listing: Listing,
  message: Message,
): Promise<void> {
  if (!db || !auth?.currentUser) {
    return;
  }

  await ensureFirestoreAuth();

  if (auth.currentUser.uid !== userId) {
    return;
  }

  await writeThreadForUser(userId, listing, message, auth.currentUser.uid);
  await writeMessageListingForUser(userId, listing.id);
}

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

export async function rebuildThreadsForUser(userId: string): Promise<void> {
  if (!db) {
    return;
  }

  await ensureFirestoreAuth();

  const listingIds = await collectListingIdsForUser(userId);

  await Promise.all(
    [...listingIds].map(async (listingId) => {
      const listing = await getListingById(listingId);
      if (!listing) {
        return;
      }

      const messages = await fetchListingMessages(
        listingId,
        getMessageAccessOptions(listing, userId),
      );
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) {
        return;
      }

      await syncMessageThreadForUser(userId, listing, lastMessage);
    }),
  );
}

export function subscribeInboxThreads(
  userId: string,
  onData: (threads: MessageThread[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!db) {
    onData([]);
    return () => undefined;
  }

  let storedThreads: MessageThread[] = [];
  let notifications: AppNotification[] = [];
  let threadUnsub: Unsubscribe | undefined;
  let notificationUnsub: Unsubscribe | undefined;
  let cancelled = false;
  let rebuildPromise: Promise<void> | null = null;
  let emitGeneration = 0;

  const emit = () => {
    const generation = ++emitGeneration;
    const merged = mergeThreads(storedThreads, notifications);

    void enrichThreads(merged).then((enriched) => {
      if (!cancelled && generation === emitGeneration) {
        onData(sortThreads(enriched));
      }
    });
  };

  const scheduleRebuild = () => {
    if (rebuildPromise) {
      return;
    }

    rebuildPromise = rebuildThreadsForUser(userId)
      .catch((error) => {
        console.warn('Thread rebuild failed (inbox will still show notification threads)', error);
      })
      .finally(() => {
        rebuildPromise = null;
      });
  };

  void ensureFirestoreAuth()
    .then(() => {
      if (cancelled || !db) {
        return;
      }

      scheduleRebuild();

      threadUnsub = onSnapshot(
        query(collection(db, 'users', userId, 'threads')),
        (snapshot) => {
          storedThreads = snapshot.docs.map((entry) => mapThread(entry.id, entry.data()));
          emit();
        },
        (error) => onError?.(error),
      );

      notificationUnsub = subscribeNotifications(
        userId,
        (nextNotifications) => {
          notifications = nextNotifications;
          emit();
          scheduleRebuild();
        },
        onError,
      );
    })
    .catch((error) => {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    });

  return () => {
    cancelled = true;
    threadUnsub?.();
    notificationUnsub?.();
  };
}
