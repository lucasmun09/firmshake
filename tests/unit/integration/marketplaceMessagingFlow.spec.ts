import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  inboxStateDocId,
  isThreadUnread,
  partitionByArchive,
} from '@/features/messages/services/inboxState';
import { createOptimisticMessage } from '@/features/messages/services/messages';
import {
  countBuyerThreadsForListing,
  enrichThreads,
  mergeThreads,
  resolveBuyerFromMessage,
  sellerThreadDocId,
  sortThreads,
} from '@/features/messages/services/threadModel';
import {
  filterMessagesForParticipant,
  groupMessagesByBuyer,
} from '@/features/listings/utils/listingConversations';
import type { AppNotification, InboxState } from '@/types';

import {
  BUYER_ID,
  LISTING_ID,
  SELLER_ID,
  makeFullListing,
  makeMessage,
  makeThread,
} from './marketplaceFixtures';

const getListingsByIds = vi.fn();
const useBffMessages = vi.fn(() => false);
const sendMessageBff = vi.fn();
const sendMessageFirestore = vi.fn();

vi.mock('@/features/listings/services/listings', () => ({
  getListingsByIds: (...args: unknown[]) => getListingsByIds(...args),
}));

vi.mock('@/common/config/featureFlags', () => ({
  useBffMessages: () => useBffMessages(),
  useBffListings: () => false,
  useBffAgreements: () => false,
  useBffUsers: () => false,
  useBffInbox: () => false,
  useBffBrowse: () => true,
}));

vi.mock('@/features/messages/services/messageBff', () => ({
  sendListingMessage: (...args: unknown[]) => sendMessageBff(...args),
}));

vi.mock('@/features/messages/services/messageFirestoreWrites', () => ({
  sendListingMessageViaFirestore: (...args: unknown[]) => sendMessageFirestore(...args),
}));

describe('integration — detail → messaging contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBffMessages.mockReturnValue(false);
    sendMessageFirestore.mockResolvedValue(makeMessage({ id: 'fs-msg-1' }));
    sendMessageBff.mockResolvedValue(makeMessage({ id: 'bff-msg-1' }));
  });

  it('keeps seller thread doc ids aligned with inboxState keys', () => {
    expect(sellerThreadDocId(LISTING_ID, BUYER_ID)).toBe(`${LISTING_ID}_${BUYER_ID}`);
    expect(inboxStateDocId(LISTING_ID, BUYER_ID)).toBe(sellerThreadDocId(LISTING_ID, BUYER_ID));
    expect(inboxStateDocId(LISTING_ID)).toBe(LISTING_ID);
  });

  it('builds buyer/seller conversation views from an optimistic first message', () => {
    const listing = makeFullListing();
    const optimistic = createOptimisticMessage(
      LISTING_ID,
      BUYER_ID,
      'Buyer Bob',
      '  Is this still available?  ',
      SELLER_ID,
    );

    expect(optimistic.text).toBe('Is this still available?');
    expect(optimistic.id.startsWith('pending-')).toBe(true);
    expect(resolveBuyerFromMessage(listing, optimistic)).toBe(BUYER_ID);

    const sellerReply = makeMessage({
      id: 'msg-2',
      senderId: SELLER_ID,
      senderName: 'Sam Seller',
      text: 'Yes — free tonight',
      recipientId: BUYER_ID,
      createdAt: new Date('2026-01-16T11:00:00Z'),
    });

    const conversations = groupMessagesByBuyer([optimistic, sellerReply], SELLER_ID);
    expect(conversations).toHaveLength(1);
    expect(conversations[0]?.buyerId).toBe(BUYER_ID);
    expect(conversations[0]?.messages).toHaveLength(2);

    expect(filterMessagesForParticipant([optimistic, sellerReply], SELLER_ID, BUYER_ID)).toHaveLength(
      2,
    );
    expect(filterMessagesForParticipant([optimistic, sellerReply], SELLER_ID, SELLER_ID)).toHaveLength(
      2,
    );
  });

  it('shows New only for other-party unread and never for archived threads', () => {
    const buyerThread = makeThread();
    const states = new Map<string, InboxState>();

    expect(isThreadUnread(buyerThread, states, BUYER_ID)).toBe(false);
    expect(isThreadUnread(buyerThread, states, SELLER_ID)).toBe(true);

    states.set(LISTING_ID, {
      listingId: LISTING_ID,
      hasViewed: true,
      isArchived: true,
      lastReadAt: new Date('2026-01-16T09:00:00Z'),
    });
    expect(isThreadUnread(buyerThread, states, SELLER_ID)).toBe(false);
  });

  it('partitions selling buyer threads by archive while counting active conversations', () => {
    const active = makeThread({
      id: sellerThreadDocId(LISTING_ID, BUYER_ID),
      buyerId: BUYER_ID,
    });
    const archived = makeThread({
      id: sellerThreadDocId(LISTING_ID, 'buyer-2'),
      buyerId: 'buyer-2',
      lastMessageSenderId: 'buyer-2',
    });
    const states = new Map<string, InboxState>([
      [
        inboxStateDocId(LISTING_ID, 'buyer-2'),
        {
          listingId: LISTING_ID,
          buyerId: 'buyer-2',
          hasViewed: true,
          isArchived: true,
        },
      ],
    ]);

    const partitioned = partitionByArchive([active, archived], states);
    expect(partitioned.active).toEqual([active]);
    expect(partitioned.archived).toEqual([archived]);
    expect(countBuyerThreadsForListing([active, archived], LISTING_ID)).toBe(2);
  });

  it('merges notification fallbacks and enriches listing metadata for inbox rows', async () => {
    const stored = [makeThread({ lastMessageText: 'older', lastMessageAt: new Date('2026-01-16T09:00:00Z') })];
    const notifications: AppNotification[] = [
      {
        id: 'n1',
        userId: SELLER_ID,
        type: 'message',
        title: 'Buyer Bob messaged you',
        body: 'Mountain Bike: Still interested?',
        listingId: LISTING_ID,
        actorId: BUYER_ID,
        read: false,
        createdAt: new Date('2026-01-16T12:00:00Z'),
      },
    ];

    const merged = mergeThreads(stored, notifications);
    expect(merged[0]?.lastMessageText).toBe('Still interested?');
    expect(sortThreads(merged)[0]?.listingId).toBe(LISTING_ID);

    getListingsByIds.mockResolvedValue(
      new Map([[LISTING_ID, makeFullListing({ title: 'Updated Bike Title', status: 'active' })]]),
    );
    const enriched = await enrichThreads(merged);
    expect(enriched[0]?.listingTitle).toBe('Updated Bike Title');
    expect(enriched[0]?.listingStatus).toBe('active');
  });

  it('routes sendListingMessage through the Firestore path when BFF messages are off', async () => {
    const { routeSendListingMessage } = await import(
      '@/features/messages/services/messageServiceRouter'
    );

    const result = await routeSendListingMessage(LISTING_ID, 'Buyer Bob', 'Hello', {
      recipientId: SELLER_ID,
    });

    expect(sendMessageFirestore).toHaveBeenCalledWith(LISTING_ID, 'Buyer Bob', 'Hello', {
      recipientId: SELLER_ID,
    });
    expect(sendMessageBff).not.toHaveBeenCalled();
    expect(result.id).toBe('fs-msg-1');
  });
});
