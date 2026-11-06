import {
  collection,
  getDocs,
  getDocsFromCache,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import type { Listing, Message } from '@/types';
import { filterMessagesForParticipant } from '@/features/listings/utils/listingConversations';
import { db } from '@/common/services/firebase';
import { ensureFirestoreAuth } from '@/common/services/firestoreAuth';
import { routeSendListingMessage } from '@/features/messages/services/messageServiceRouter';
import { normalizeMessageImageUrl } from '@/features/messages/utils/messageImage';

export const MESSAGES_PAGE_SIZE = 50;

export interface MessageSnapshotMeta {
  fromCache: boolean;
  hasPendingWrites: boolean;
}

function mapMessage(id: string, listingId: string, data: Record<string, unknown>): Message {
  const createdAt = data.createdAt;
  const imageUrl = normalizeMessageImageUrl(data.imageUrl);
  return {
    id,
    listingId,
    senderId: String(data.senderId ?? ''),
    senderName: String(data.senderName ?? 'Unknown'),
    text: String(data.text ?? ''),
    imageUrl,
    recipientId: data.recipientId ? String(data.recipientId) : undefined,
    createdAt:
      createdAt && typeof createdAt === 'object' && 'toDate' in createdAt
        ? (createdAt as { toDate: () => Date }).toDate()
        : undefined,
  };
}

function sortMessages(messages: Message[]): Message[] {
  return [...messages].sort((left, right) => {
    const leftTime = left.createdAt?.getTime() ?? 0;
    const rightTime = right.createdAt?.getTime() ?? 0;
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return left.id.localeCompare(right.id);
  });
}

function mergeMessageSnapshots(
  listingId: string,
  snapshots: Array<{ id: string; data: () => Record<string, unknown> }>,
): Message[] {
  const byId = new Map<string, Message>();
  for (const entry of snapshots) {
    byId.set(entry.id, mapMessage(entry.id, listingId, entry.data()));
  }
  return sortMessages([...byId.values()]);
}

function messagesCollection(listingId: string) {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  return collection(db, 'listings', listingId, 'messages');
}

async function fetchSellerMessages(
  listingId: string,
  preferCache = false,
): Promise<Message[]> {
  const messagesQuery = query(messagesCollection(listingId));

  if (preferCache) {
    try {
      const cached = await getDocsFromCache(messagesQuery);
      return sortMessages(
        cached.docs.map((entry) => mapMessage(entry.id, listingId, entry.data())),
      );
    } catch {
      // Fall through to network read.
    }
  }

  const snapshot = await getDocs(messagesQuery);
  return sortMessages(
    snapshot.docs.map((entry) => mapMessage(entry.id, listingId, entry.data())),
  );
}

export async function loadOlderListingMessages(
  listingId: string,
  beforeDoc: DocumentSnapshot,
  options?: { sellerId?: string; participantId?: string; pageSize?: number },
): Promise<{ messages: Message[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> {
  const pageSize = options?.pageSize ?? MESSAGES_PAGE_SIZE;

  if (options?.participantId) {
    const ref = messagesCollection(listingId);
    const sentQuery = query(
      ref,
      where('senderId', '==', options.participantId),
      orderBy('createdAt', 'desc'),
      startAfter(beforeDoc),
      limit(pageSize + 1),
    );
    const receivedQuery = query(
      ref,
      where('recipientId', '==', options.participantId),
      orderBy('createdAt', 'desc'),
      startAfter(beforeDoc),
      limit(pageSize + 1),
    );
    const [sentSnapshot, receivedSnapshot] = await Promise.all([
      getDocs(sentQuery),
      getDocs(receivedQuery),
    ]);
    const merged = mergeMessageSnapshots(listingId, [
      ...sentSnapshot.docs,
      ...receivedSnapshot.docs,
    ]);
    return {
      messages: merged.slice(0, pageSize),
      lastDoc: sentSnapshot.docs[0] ?? receivedSnapshot.docs[0] ?? null,
      hasMore: sentSnapshot.size + receivedSnapshot.size > pageSize,
    };
  }

  const messagesQuery = query(
    messagesCollection(listingId),
    orderBy('createdAt', 'desc'),
    startAfter(beforeDoc),
    limit(pageSize + 1),
  );
  const snapshot = await getDocs(messagesQuery);
  const docs = snapshot.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;

  return {
    messages: sortMessages(pageDocs.map((entry) => mapMessage(entry.id, listingId, entry.data()))),
    lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
    hasMore,
  };
}

async function fetchParticipantMessages(
  listingId: string,
  participantId: string,
  preferCache = false,
): Promise<Message[]> {
  const ref = messagesCollection(listingId);
  const sentQuery = query(ref, where('senderId', '==', participantId));
  const receivedQuery = query(ref, where('recipientId', '==', participantId));

  if (preferCache) {
    try {
      const [sentSnapshot, receivedSnapshot] = await Promise.all([
        getDocsFromCache(sentQuery),
        getDocsFromCache(receivedQuery),
      ]);
      return mergeMessageSnapshots(listingId, [...sentSnapshot.docs, ...receivedSnapshot.docs]);
    } catch {
      // Fall through to network read.
    }
  }

  const [sentSnapshot, receivedSnapshot] = await Promise.all([
    getDocs(sentQuery),
    getDocs(receivedQuery),
  ]);

  return mergeMessageSnapshots(listingId, [...sentSnapshot.docs, ...receivedSnapshot.docs]);
}

export function getMessageAccessOptions(
  listing: Listing,
  userId: string,
): { sellerId: string; participantId: string } | undefined {
  if (userId === listing.sellerId) {
    return undefined;
  }

  return {
    sellerId: listing.sellerId,
    participantId: userId,
  };
}

export async function fetchListingMessages(
  listingId: string,
  options?: { sellerId?: string; participantId?: string; preferCache?: boolean },
): Promise<Message[]> {
  if (!db) {
    return [];
  }

  await ensureFirestoreAuth();

  if (options?.participantId) {
    return fetchParticipantMessages(
      listingId,
      options.participantId,
      options.preferCache ?? false,
    );
  }

  return fetchSellerMessages(listingId, options?.preferCache ?? false);
}

function subscribeSellerMessages(
  listingId: string,
  onData: (messages: Message[], meta: MessageSnapshotMeta) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(messagesCollection(listingId)),
    { includeMetadataChanges: true },
    (snapshot) => {
      onData(
        sortMessages(
          snapshot.docs.map((entry) => mapMessage(entry.id, listingId, entry.data())),
        ),
        {
          fromCache: snapshot.metadata.fromCache,
          hasPendingWrites: snapshot.metadata.hasPendingWrites,
        },
      );
    },
    (error) => onError?.(error),
  );
}

function subscribeParticipantMessages(
  listingId: string,
  participantId: string,
  onData: (messages: Message[], meta: MessageSnapshotMeta) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const ref = messagesCollection(listingId);
  let sentMessages: Message[] = [];
  let receivedMessages: Message[] = [];
  let sentMeta: MessageSnapshotMeta = { fromCache: true, hasPendingWrites: false };
  let receivedMeta: MessageSnapshotMeta = { fromCache: true, hasPendingWrites: false };

  const emit = () => {
    const byId = new Map<string, Message>();
    for (const message of [...sentMessages, ...receivedMessages]) {
      byId.set(message.id, message);
    }
    onData(sortMessages([...byId.values()]), {
      fromCache: sentMeta.fromCache && receivedMeta.fromCache,
      hasPendingWrites: sentMeta.hasPendingWrites || receivedMeta.hasPendingWrites,
    });
  };

  const unsubSent = onSnapshot(
    query(ref, where('senderId', '==', participantId)),
    { includeMetadataChanges: true },
    (snapshot) => {
      sentMessages = snapshot.docs.map((entry) =>
        mapMessage(entry.id, listingId, entry.data()),
      );
      sentMeta = {
        fromCache: snapshot.metadata.fromCache,
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
      };
      emit();
    },
    (error) => onError?.(error),
  );

  const unsubReceived = onSnapshot(
    query(ref, where('recipientId', '==', participantId)),
    { includeMetadataChanges: true },
    (snapshot) => {
      receivedMessages = snapshot.docs.map((entry) =>
        mapMessage(entry.id, listingId, entry.data()),
      );
      receivedMeta = {
        fromCache: snapshot.metadata.fromCache,
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
      };
      emit();
    },
    (error) => onError?.(error),
  );

  return () => {
    unsubSent();
    unsubReceived();
  };
}

export function subscribeListingMessages(
  listingId: string,
  onData: (messages: Message[], meta: MessageSnapshotMeta) => void,
  onError?: (error: Error) => void,
  options?: { sellerId?: string; participantId?: string },
): Unsubscribe {
  if (!db) {
    onData([], { fromCache: true, hasPendingWrites: false });
    return () => undefined;
  }

  let innerUnsub: Unsubscribe | undefined;
  let cancelled = false;

  void ensureFirestoreAuth()
    .then(() => {
      if (cancelled || !db) {
        return;
      }

      if (options?.participantId) {
        innerUnsub = subscribeParticipantMessages(
          listingId,
          options.participantId,
          (messages, meta) => {
            const filtered =
              options.sellerId && options.participantId
                ? filterMessagesForParticipant(messages, options.sellerId, options.participantId)
                : messages;
            onData(filtered, meta);
          },
          onError,
        );
        return;
      }

      innerUnsub = subscribeSellerMessages(listingId, onData, onError);
    })
    .catch((error) => {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    });

  return () => {
    cancelled = true;
    innerUnsub?.();
  };
}

export async function sendListingMessage(
  listingId: string,
  senderName: string,
  text: string,
  options?: { recipientId?: string; imageUrl?: string },
): Promise<Message> {
  return routeSendListingMessage(listingId, senderName, text, options);
}

export function createOptimisticMessage(
  listingId: string,
  senderId: string,
  senderName: string,
  text: string,
  recipientId?: string,
  imageUrl?: string,
): Message {
  const normalizedImage = normalizeMessageImageUrl(imageUrl);
  return {
    id: `pending-${Date.now()}`,
    listingId,
    senderId,
    senderName,
    text: text.trim(),
    imageUrl: normalizedImage,
    recipientId,
    createdAt: new Date(),
  };
}
