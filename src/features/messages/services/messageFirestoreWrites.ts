import {
  addDoc,
  collection,
  Timestamp,
} from 'firebase/firestore';

import { auth, db } from '@/common/services/firebase';
import { isUserBlocked } from '@/common/services/blocks';
import { ensureFirestoreAuth } from '@/common/services/firestoreAuth';
import { createNotification } from '@/features/messages/services/notifications';
import { getListingById } from '@/features/listings/services/listings';
import { syncMessageThreads } from '@/features/messages/services/threads';
import type { Message } from '@/types';
import {
  normalizeMessageImageUrl,
  resolveMessagePreviewText,
  resolveMessageTextForSend,
} from '@/features/messages/utils/messageImage';

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
      return;
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

/** Direct Firestore send (thread sync + notification client-side). Used when BFF flag is off. */
export async function sendListingMessageViaFirestore(
  listingId: string,
  senderName: string,
  text: string,
  options?: { recipientId?: string; imageUrl?: string },
): Promise<Message> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  await ensureFirestoreAuth();

  const user = auth?.currentUser;
  if (!user) {
    throw new Error('You must be signed in to send messages');
  }

  const imageUrl = normalizeMessageImageUrl(options?.imageUrl);
  const trimmed = resolveMessageTextForSend(text, imageUrl);

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
  const payload: Record<string, unknown> = {
    senderId: user.uid,
    senderName,
    text: trimmed,
    createdAt,
    recipientId,
  };
  if (imageUrl) {
    payload.imageUrl = imageUrl;
  }

  const docRef = await addDoc(collection(db, 'listings', listingId, 'messages'), payload);

  const message: Message = {
    id: docRef.id,
    listingId,
    senderId: user.uid,
    senderName,
    text: trimmed,
    imageUrl,
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
      resolveMessagePreviewText(trimmed, imageUrl),
      recipientId,
    );
  } catch (error) {
    console.warn('Message sent, but notification could not be created', error);
  }

  return message;
}
