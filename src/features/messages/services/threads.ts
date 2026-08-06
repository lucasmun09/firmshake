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

import type { AppNotification, Listing, ListingConversation, Message, MessageThread } from '@/types';
import { groupMessagesByBuyer } from '@/features/listings/utils/listingConversations';
import { normalizeImageUrl } from '@/utils/apiBaseUrl';
import { auth, db } from '@/common/services/firebase';
import { debugLog, serializeError } from '@/common/debug/debugLog';
import {
  attachRetriableSnapshot,
  createFirestoreSnapshotErrorHandler,
  ensureFirestoreAuth,
  isSessionExpiredError,
  SessionExpiredError,
} from '@/common/services/firestoreAuth';
import { getListingsByIds } from '@/features/listings/services/listings';
import { fetchListingMessages, getMessageAccessOptions } from '@/features/messages/services/messages';
import { subscribeNotifications } from '@/features/messages/services/notifications';

export const THREADS_PAGE_SIZE = 30;

function mapThread(id: string, data: Record<string, unknown>): MessageThread {
  const lastMessageAt = data.lastMessageAt;
  return {
    id,
    listingId: String(data.listingId ?? id.split('_')[0] ?? id),
    buyerId: data.buyerId ? String(data.buyerId) : undefined,
    buyerName: data.buyerName ? String(data.buyerName) : undefined,
    listingTitle: String(data.listingTitle ?? 'Listing'),
    listingImageUrl: normalizeImageUrl(String(data.listingImageUrl ?? '')),
    listingStatus: data.listingStatus
      ? (String(data.listingStatus) as MessageThread['listingStatus'])
      : undefined,
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

function sellerThreadDocId(listingId: string, buyerId: string): string {
  return `${listingId}_${buyerId}`;
}

function resolveBuyerFromMessage(listing: Listing, message: Message): string | null {
  if (message.senderId !== listing.sellerId) {
    return message.senderId;
  }

  if (message.recipientId && message.recipientId !== listing.sellerId) {
    return message.recipientId;
  }

  return null;
}

async function enrichThreads(threads: MessageThread[]): Promise<MessageThread[]> {
  if (threads.length === 0) {
    return [];
  }

  const listingIds = [...new Set(threads.map((thread) => thread.listingId))];
  const listingsById = await getListingsByIds(listingIds, { preferCache: true });

  return threads.map((thread) => {
    const listing = listingsById.get(thread.listingId);
    if (!listing) {
      return {
        ...thread,
        listingStatus: thread.listingStatus ?? 'removed',
      };
    }

    return {
      ...thread,
      listingTitle: listing.title,
      listingImageUrl: listing.imageUrl || thread.listingImageUrl,
      sellerId: listing.sellerId || thread.sellerId,
      sellerName: listing.sellerName || thread.sellerName,
      listingStatus: listing.status,
    };
  });
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
    merged.set(thread.id, thread);
  }

  for (const notification of notifications) {
    const fallback = threadFromNotification(notification);
    if (!fallback) {
      continue;
    }

    const existing = merged.get(fallback.id);
    if (!existing) {
      merged.set(fallback.id, fallback);
      continue;
    }

    const existingTime = existing.lastMessageAt?.getTime() ?? 0;
    const fallbackTime = fallback.lastMessageAt?.getTime() ?? 0;
    if (fallbackTime > existingTime) {
      merged.set(fallback.id, {
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

export function countBuyerThreadsForListing(
  threads: MessageThread[],
  listingId: string,
): number {
  return threads.filter((thread) => thread.listingId === listingId && thread.buyerId).length;
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

async function writeSellerConversationThread(
  userId: string,
  listing: Listing,
  conversation: ListingConversation,
  updatedBy: string,
): Promise<void> {
  if (!db) {
    return;
  }

  const lastMessage = conversation.lastMessage;
  if (!lastMessage) {
    return;
  }

  await setDoc(
    doc(db, 'users', userId, 'threads', sellerThreadDocId(listing.id, conversation.buyerId)),
    {
      listingId: listing.id,
      buyerId: conversation.buyerId,
      buyerName: conversation.buyerName,
      listingTitle: listing.title,
      listingImageUrl: listing.imageUrl,
      listingStatus: listing.status,
      sellerId: listing.sellerId,
      sellerName: listing.sellerName,
      lastMessageText: lastMessage.text,
      lastMessageSenderId: lastMessage.senderId,
      lastMessageSenderName: lastMessage.senderName,
      lastMessageAt: lastMessage.createdAt
        ? Timestamp.fromDate(lastMessage.createdAt)
        : Timestamp.now(),
      updatedAt: Timestamp.now(),
      updatedBy,
    },
    { merge: true },
  );
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

  const isSeller = userId === listing.sellerId;

  if (isSeller) {
    const buyerId = resolveBuyerFromMessage(listing, message);
    if (!buyerId) {
      return;
    }

    const payload: Record<string, unknown> = {
      listingId: listing.id,
      buyerId,
      listingTitle: listing.title,
      listingImageUrl: listing.imageUrl,
      listingStatus: listing.status,
      sellerId: listing.sellerId,
      sellerName: listing.sellerName,
      lastMessageText: message.text,
      lastMessageSenderId: message.senderId,
      lastMessageSenderName: message.senderName,
      lastMessageAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      updatedBy,
    };

    if (message.senderId === buyerId) {
      payload.buyerName = message.senderName;
    }

    await setDoc(
      doc(db, 'users', userId, 'threads', sellerThreadDocId(listing.id, buyerId)),
      payload,
      { merge: true },
    );
    return;
  }

  await setDoc(
    doc(db, 'users', userId, 'threads', listing.id),
    {
      listingId: listing.id,
      listingTitle: listing.title,
      listingImageUrl: listing.imageUrl,
      listingStatus: listing.status,
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

const REBUILD_CONCURRENCY = 5;

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

async function mapWithConcurrency<T>(
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
  let rebuildDebounceTimer: number | undefined;
  let emitGeneration = 0;

  const emit = () => {
    const generation = ++emitGeneration;
    const merged = mergeThreads(storedThreads, notifications);

    void enrichThreads(merged)
      .then((enriched) => {
        if (!cancelled && generation === emitGeneration) {
          onData(sortThreads(enriched));
        }
      })
      .catch((error) => {
        debugLog.warn('threads', 'Thread enrich batch failed; emitting unenriched threads', {
          userId,
          count: merged.length,
          error: serializeError(error),
        });
        if (!cancelled && generation === emitGeneration) {
          onData(sortThreads(merged));
        }
      });
  };

  const scheduleRebuild = (debounceMs = 0) => {
    if (rebuildPromise) {
      return;
    }

    if (rebuildDebounceTimer !== undefined) {
      window.clearTimeout(rebuildDebounceTimer);
      rebuildDebounceTimer = undefined;
    }

    const run = () => {
      rebuildPromise = rebuildThreadsForUser(userId)
        .catch((error) => {
          if (isSessionExpiredError(error)) {
            return;
          }
          console.warn('Thread rebuild failed (inbox will still show notification threads)', error);
        })
        .finally(() => {
          rebuildPromise = null;
        });
    };

    if (debounceMs > 0) {
      rebuildDebounceTimer = window.setTimeout(run, debounceMs);
      return;
    }

    run();
  };

  void ensureFirestoreAuth()
    .then(() => {
      if (cancelled || !db) {
        return;
      }

      debugLog.debug('threads', 'subscribeInboxThreads: Firestore auth ready', { userId });
      scheduleRebuild();

      threadUnsub = attachRetriableSnapshot(
        (onSnapshotError) => onSnapshot(
          query(collection(db!, 'users', userId, 'threads')),
          (snapshot) => {
            storedThreads = sortThreads(
              snapshot.docs.map((entry) => mapThread(entry.id, entry.data())),
            ).slice(0, THREADS_PAGE_SIZE);
            debugLog.debug('threads', 'Inbox threads snapshot', {
              userId,
              count: storedThreads.length,
            });
            emit();
          },
          createFirestoreSnapshotErrorHandler(onSnapshotError, 'subscribeInboxThreads'),
        ),
        onError,
        'subscribeInboxThreads',
      );

      notificationUnsub = subscribeNotifications(
        userId,
        (nextNotifications) => {
          notifications = nextNotifications;
          emit();
          if (storedThreads.length === 0) {
            scheduleRebuild(1500);
          }
        },
        (notificationError) => {
          if (isSessionExpiredError(notificationError)) {
            onError?.(notificationError instanceof Error ? notificationError : new SessionExpiredError());
            return;
          }
          console.warn('Notifications subscription failed (inbox threads still load)', notificationError);
        },
      );
    })
    .catch((error) => {
      if (isSessionExpiredError(error)) {
        onError?.(error instanceof Error ? error : new SessionExpiredError());
        return;
      }
      debugLog.warn('threads', 'subscribeInboxThreads: ensureFirestoreAuth failed', {
        userId,
        error: serializeError(error),
      });
      onError?.(error instanceof Error ? error : new Error(String(error)));
    });

  return () => {
    cancelled = true;
    if (rebuildDebounceTimer !== undefined) {
      window.clearTimeout(rebuildDebounceTimer);
    }
    threadUnsub?.();
    notificationUnsub?.();
  };
}
