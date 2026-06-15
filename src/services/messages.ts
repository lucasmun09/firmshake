import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  Timestamp,
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

  const snapshot = await getDocs(query(collection(db, 'listings', listingId, 'messages')));
  const messages = sortMessages(
    snapshot.docs.map((entry) => mapMessage(entry.id, listingId, entry.data())),
  );

  if (options?.sellerId && options.participantId) {
    return filterMessagesForParticipant(messages, options.sellerId, options.participantId);
  }

  return messages;
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

      const messagesQuery = query(collection(db, 'listings', listingId, 'messages'));

      innerUnsub = onSnapshot(
        messagesQuery,
        (snapshot) => {
          const messages = sortMessages(
            snapshot.docs.map((entry) => mapMessage(entry.id, listingId, entry.data())),
          );
          const filtered =
            options?.sellerId && options.participantId
              ? filterMessagesForParticipant(messages, options.sellerId, options.participantId)
              : messages;
          onData(filtered);
        },
        (error) => onError?.(error),
      );
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
      const recentMessages = await fetchListingMessages(listingId);
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
