import { doc, setDoc, Timestamp } from 'firebase/firestore';

import type { Listing, ListingConversation, Message } from '@/types';
import { auth, db } from '@/common/services/firebase';
import { ensureFirestoreAuth } from '@/common/services/firestoreAuth';
import {
  resolveBuyerFromMessage,
  sellerThreadDocId,
} from '@/features/messages/services/threadModel';

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

export async function writeSellerConversationThread(
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
