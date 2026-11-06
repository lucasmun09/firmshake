import { describe, expect, it } from 'vitest';

import {
  countBuyerThreadsForListing,
  mapThread,
  mergeThreads,
  resolveBuyerFromMessage,
  sellerThreadDocId,
  sortThreads,
  threadFromNotification,
} from '@/features/messages/services/threadModel';
import type { AppNotification, Listing, Message, MessageThread } from '@/types';

function thread(overrides: Partial<MessageThread> & Pick<MessageThread, 'id'>): MessageThread {
  return {
    listingId: 'listing-1',
    listingTitle: 'Bike',
    listingImageUrl: '',
    sellerId: 'seller-1',
    sellerName: 'Seller',
    lastMessageText: 'hi',
    lastMessageSenderId: 'buyer-1',
    lastMessageSenderName: 'Buyer',
    ...overrides,
  };
}

describe('threadModel', () => {
  it('builds seller thread doc ids as listingId_buyerId', () => {
    expect(sellerThreadDocId('listing-1', 'buyer-9')).toBe('listing-1_buyer-9');
  });

  it('resolves buyer from inbound and outbound messages', () => {
    const listing = { sellerId: 'seller-1' } as Listing;

    expect(
      resolveBuyerFromMessage(listing, {
        senderId: 'buyer-2',
        recipientId: 'seller-1',
      } as Message),
    ).toBe('buyer-2');

    expect(
      resolveBuyerFromMessage(listing, {
        senderId: 'seller-1',
        recipientId: 'buyer-3',
      } as Message),
    ).toBe('buyer-3');

    expect(
      resolveBuyerFromMessage(listing, {
        senderId: 'seller-1',
        recipientId: 'seller-1',
      } as Message),
    ).toBeNull();
  });

  it('maps Firestore thread docs including Timestamp-like lastMessageAt', () => {
    const at = new Date('2026-06-20T12:00:00Z');
    const mapped = mapThread('listing-1_buyer-1', {
      listingId: 'listing-1',
      buyerId: 'buyer-1',
      listingTitle: 'Desk',
      listingImageUrl: '/img/desk.jpg',
      sellerId: 'seller-1',
      sellerName: 'Sam',
      lastMessageText: 'still available?',
      lastMessageSenderId: 'buyer-1',
      lastMessageSenderName: 'Pat',
      lastMessageAt: { toDate: () => at },
    });

    expect(mapped).toMatchObject({
      id: 'listing-1_buyer-1',
      listingId: 'listing-1',
      buyerId: 'buyer-1',
      listingTitle: 'Desk',
      lastMessageText: 'still available?',
    });
    expect(mapped.lastMessageAt?.toISOString()).toBe(at.toISOString());
  });

  it('sorts threads newest-first', () => {
    const sorted = sortThreads([
      thread({ id: 'a', lastMessageAt: new Date('2026-01-01T00:00:00Z') }),
      thread({ id: 'b', lastMessageAt: new Date('2026-06-01T00:00:00Z') }),
      thread({ id: 'c' }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(['b', 'a', 'c']);
  });

  it('builds a fallback thread from a message notification', () => {
    const notification: AppNotification = {
      id: 'n1',
      type: 'message',
      title: 'Pat messaged you',
      body: 'Desk: still available?',
      recipientId: 'seller-1',
      actorId: 'buyer-1',
      listingId: 'listing-1',
      createdAt: new Date('2026-06-20T12:00:00Z'),
      read: false,
    };

    expect(threadFromNotification(notification)).toMatchObject({
      id: 'listing-1',
      listingId: 'listing-1',
      listingTitle: 'Desk',
      lastMessageText: 'still available?',
      lastMessageSenderId: 'buyer-1',
      lastMessageSenderName: 'Pat',
    });
  });

  it('ignores non-message notifications', () => {
    expect(
      threadFromNotification({
        id: 'n2',
        type: 'system',
        title: 'Meetup',
        body: 'Agreed',
        recipientId: 'seller-1',
        actorId: 'buyer-1',
        listingId: 'listing-1',
        createdAt: new Date(),
        read: false,
      }),
    ).toBeNull();
  });

  it('merges notification fallbacks without overwriting newer stored threads', () => {
    const stored = [
      thread({
        id: 'listing-1',
        lastMessageText: 'stored newer',
        lastMessageAt: new Date('2026-06-20T13:00:00Z'),
        lastMessageSenderId: 'seller-1',
        lastMessageSenderName: 'Sam',
      }),
    ];
    const notifications: AppNotification[] = [
      {
        id: 'n1',
        type: 'message',
        title: 'Pat messaged you',
        body: 'Desk: older ping',
        recipientId: 'seller-1',
        actorId: 'buyer-1',
        listingId: 'listing-1',
        createdAt: new Date('2026-06-20T12:00:00Z'),
        read: false,
      },
      {
        id: 'n2',
        type: 'message',
        title: 'Alex messaged you',
        body: 'Lamp: hello',
        recipientId: 'seller-1',
        actorId: 'buyer-2',
        listingId: 'listing-2',
        createdAt: new Date('2026-06-20T14:00:00Z'),
        read: false,
      },
    ];

    const merged = mergeThreads(stored, notifications);
    expect(merged.map((entry) => entry.id)).toEqual(['listing-2', 'listing-1']);
    expect(merged.find((entry) => entry.id === 'listing-1')?.lastMessageText).toBe('stored newer');
    expect(merged.find((entry) => entry.id === 'listing-2')?.lastMessageText).toBe('hello');
  });

  it('updates stored thread preview when notification is newer', () => {
    const stored = [
      thread({
        id: 'listing-1',
        lastMessageText: 'old',
        lastMessageAt: new Date('2026-06-20T10:00:00Z'),
      }),
    ];
    const notifications: AppNotification[] = [
      {
        id: 'n1',
        type: 'message',
        title: 'Pat messaged you',
        body: 'Desk: brand new',
        recipientId: 'seller-1',
        actorId: 'buyer-1',
        listingId: 'listing-1',
        createdAt: new Date('2026-06-20T12:00:00Z'),
        read: false,
      },
    ];

    const merged = mergeThreads(stored, notifications);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.lastMessageText).toBe('brand new');
    expect(merged[0]?.lastMessageSenderId).toBe('buyer-1');
  });

  it('counts buyer threads for a listing', () => {
    const threads = [
      thread({ id: 'listing-1_buyer-1', listingId: 'listing-1', buyerId: 'buyer-1' }),
      thread({ id: 'listing-1_buyer-2', listingId: 'listing-1', buyerId: 'buyer-2' }),
      thread({ id: 'listing-1', listingId: 'listing-1' }),
      thread({ id: 'listing-2_buyer-1', listingId: 'listing-2', buyerId: 'buyer-1' }),
    ];

    expect(countBuyerThreadsForListing(threads, 'listing-1')).toBe(2);
  });
});
