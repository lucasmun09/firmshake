import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import type { Listing, Message } from '@/types';
import { filterMessagesForParticipant } from '@/utils/listingConversations';
import { auth, db } from './firebase';
import { isUserBlocked } from './blocks';
import { ensureFirestoreAuth } from './firestoreAuth';
import { createNotification } from './notifications';
import { getListingById } from './listings';
import { syncMessageThreads } from './threads';

function mapMessage(id: string, listingId: string, data: Record<string, unknown>): Message {
  const createdAt = data.createdAt;
  return {
    id,
    listingId,
    senderId: String(data.senderId ?? ''),
    senderName: String(data.senderName ?? 'Unknown'),
    text: String(data.text ?? ''),
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

async function fetchSellerMessages(listingId: string): Promise<Message[]> {
  const snapshot = await getDocs(query(messagesCollection(listingId)));
  return sortMessages(
    snapshot.docs.map((entry) => mapMessage(entry.id, listingId, entry.data())),
  );
}

async function fetchParticipantMessages(
  listingId: string,
  participantId: string,
): Promise<Message[]> {
  const ref = messagesCollection(listingId);
  const [sentSnapshot, receivedSnapshot] = await Promise.all([
    getDocs(query(ref, where('senderId', '==', participantId))),
    getDocs(query(ref, where('recipientId', '==', participantId))),
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
  options?: { sellerId?: string; participantId?: string },
): Promise<Message[]> {
  if (!db) {
    return [];
  }

  await ensureFirestoreAuth();

  if (options?.participantId) {
    return fetchParticipantMessages(listingId, options.participantId);
  }

  return fetchSellerMessages(listingId);
}

function subscribeSellerMessages(
  listingId: string,
  onData: (messages: Message[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(messagesCollection(listingId)),
    (snapshot) => {
      onData(
        sortMessages(
          snapshot.docs.map((entry) => mapMessage(entry.id, listingId, entry.data())),
        ),
      );
    },
    (error) => onError?.(error),
  );
}

function subscribeParticipantMessages(
  listingId: string,
  participantId: string,
  onData: (messages: Message[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const ref = messagesCollection(listingId);
  let sentMessages: Message[] = [];
  let receivedMessages: Message[] = [];

  const emit = () => {
    const byId = new Map<string, Message>();
    for (const message of [...sentMessages, ...receivedMessages]) {
      byId.set(message.id, message);
    }
    onData(sortMessages([...byId.values()]));
  };

  const unsubSent = onSnapshot(
    query(ref, where('senderId', '==', participantId)),
    (snapshot) => {
      sentMessages = snapshot.docs.map((entry) =>
        mapMessage(entry.id, listingId, entry.data()),
      );
      emit();
    },
    (error) => onError?.(error),
  );

  const unsubReceived = onSnapshot(
    query(ref, where('recipientId', '==', participantId)),
    (snapshot) => {
      receivedMessages = snapshot.docs.map((entry) =>
        mapMessage(entry.id, listingId, entry.data()),
      );
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
  onData: (messages: Message[]) => void,
  onError?: (error: Error) => void,
  options?: { sellerId?: string; participantId?: string },
): Unsubscribe {
  if (!db) {
    onData([]);
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
          (messages) => {
            const filtered =
              options.sellerId && options.participantId
                ? filterMessagesForParticipant(messages, options.sellerId, options.participantId)
                : messages;
            onData(filtered);
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

async function notifyMessageRecipient(
  listingId: string,
  senderId: string,
  senderName: string,
  text: string,
  explicitRecipientId?: string,
): Promise<void> {
  const listing = await getListingById(listingId);
  if (!listing) {
    return;
  }

  let recipientId: string | null = explicitRecipientId ?? null;

  if (!recipientId) {
    if (senderId !== listing.sellerId) {
      recipientId = listing.sellerId;
    } else {
      const recentMessages = await fetchSellerMessages(listingId);
      const latestBuyerMessage = [...recentMessages]
        .reverse()
        .find((message) => message.senderId !== listing.sellerId);
      recipientId = latestBuyerMessage?.senderId ?? null;
    }
  }

  if (!recipientId || recipientId === senderId) {
    return;
  }

  await createNotification({
    recipientId,
    actorId: senderId,
    type: 'message',
    title: `${senderName} messaged you`,
    body: `${listing.title}: ${text}`,
    listingId,
  });
}

export async function sendListingMessage(
  listingId: string,
  senderName: string,
  text: string,
  options?: { recipientId?: string },
): Promise<Message> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  await ensureFirestoreAuth();

  const user = auth?.currentUser;
  if (!user) {
    throw new Error('You must be signed in to send messages');
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Message cannot be empty');
  }

  const listing = await getListingById(listingId);
  if (!listing) {
    throw new Error('Listing not found');
  }

  const recipientId =
    options?.recipientId ??
    (user.uid !== listing.sellerId ? listing.sellerId : undefined);

  if (!recipientId) {
    throw new Error('Choose a buyer before replying');
  }

  const blocked = await isUserBlocked(recipientId, user.uid);
  if (blocked) {
    throw new Error('This user is not accepting messages from you');
  }

  const createdAt = Timestamp.now();
  const docRef = await addDoc(collection(db, 'listings', listingId, 'messages'), {
    senderId: user.uid,
    senderName,
    text: trimmed,
    createdAt,
    recipientId,
  });

  const message: Message = {
    id: docRef.id,
    listingId,
    senderId: user.uid,
    senderName,
    text: trimmed,
    recipientId,
    createdAt: createdAt.toDate(),
  };

  try {
    await syncMessageThreads(listing, message);
  } catch (error) {
    console.warn('Message sent, but thread index could not be updated', error);
  }

  try {
    await notifyMessageRecipient(
      listingId,
      user.uid,
      senderName,
      trimmed,
      recipientId,
    );
  } catch (error) {
    console.warn('Message sent, but notification could not be created', error);
  }

  return message;
}

export function createOptimisticMessage(
  listingId: string,
  senderId: string,
  senderName: string,
  text: string,
  recipientId?: string,
): Message {
  return {
    id: `pending-${Date.now()}`,
    listingId,
    senderId,
    senderName,
    text: text.trim(),
    recipientId,
    createdAt: new Date(),
  };
}
