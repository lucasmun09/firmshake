import type { AppNotification, Listing, Message, MessageThread } from '@/types';
import { normalizeImageUrl } from '@/utils/apiBaseUrl';
import { getListingsByIds } from '@/features/listings/services/listings';
import {
  getThreadEnrichListings,
  setThreadEnrichListings,
} from '@/features/messages/services/threadEnrichCache';

export const THREADS_PAGE_SIZE = 30;

export function sellerThreadDocId(listingId: string, buyerId: string): string {
  return `${listingId}_${buyerId}`;
}

export function resolveBuyerFromMessage(listing: Listing, message: Message): string | null {
  if (message.senderId !== listing.sellerId) {
    return message.senderId;
  }

  if (message.recipientId && message.recipientId !== listing.sellerId) {
    return message.recipientId;
  }

  return null;
}

export function mapThread(id: string, data: Record<string, unknown>): MessageThread {
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

export async function enrichThreads(threads: MessageThread[]): Promise<MessageThread[]> {
  if (threads.length === 0) {
    return [];
  }

  const listingIds = [...new Set(threads.map((thread) => thread.listingId))];
  const cached = getThreadEnrichListings(listingIds);
  const missingIds = listingIds.filter((id) => !cached.has(id));
  const fetched =
    missingIds.length > 0
      ? await getListingsByIds(missingIds, { preferCache: true })
      : new Map<string, Listing>();

  if (fetched.size > 0) {
    setThreadEnrichListings([...fetched.values()]);
  }

  return threads.map((thread) => {
    const listing = cached.get(thread.listingId) ?? fetched.get(thread.listingId);
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

export function sortThreads(threads: MessageThread[]): MessageThread[] {
  return [...threads].sort((left, right) => {
    const leftTime = left.lastMessageAt?.getTime() ?? 0;
    const rightTime = right.lastMessageAt?.getTime() ?? 0;
    return rightTime - leftTime;
  });
}

export function threadFromNotification(notification: AppNotification): MessageThread | null {
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

export function mergeThreads(
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
