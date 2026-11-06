/**
 * End-to-end marketplace chain without payments:
 * browse summary → detail availability → save → message → sell thread count.
 * Pure/module contracts only — live Firestore/Cypress covered separately.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { summarizeBrowseSearchResult } from '@/features/listings/services/browseSearchSummary';
import { listingFromCreatePayload } from '@/features/listings/services/listingFeed';
import { setListingPrefsOwnerUid } from '@/features/listings/services/listingPrefsStorage';
import { isListingAvailableForBrowse } from '@/features/listings/services/listingStatus';
import {
  getSavedListings,
  isListingSaved,
  saveListing,
  toggleSavedListing,
} from '@/features/listings/services/savedListings';
import {
  filterMessagesForParticipant,
  groupMessagesByBuyer,
} from '@/features/listings/utils/listingConversations';
import { toListingSummary } from '@/features/listings/utils/listingSummary';
import {
  inboxStateDocId,
  isThreadUnread,
  partitionByArchive,
} from '@/features/messages/services/inboxState';
import { createOptimisticMessage } from '@/features/messages/services/messages';
import {
  countBuyerThreadsForListing,
  resolveBuyerFromMessage,
  sellerThreadDocId,
} from '@/features/messages/services/threadModel';
import type { InboxState } from '@/types';

import {
  BUYER_ID,
  LISTING_ID,
  SELLER_ID,
  makeFullListing,
  makeThread,
  stubLocalStorage,
} from './marketplaceFixtures';

describe('integration — marketplace flow chain (no payments)', () => {
  beforeEach(() => {
    stubLocalStorage();
    setListingPrefsOwnerUid(BUYER_ID);
  });

  it('walks browse → detail → saved → messaging → sell without deposit/payment fields', () => {
    // 1) Seller creates a listing (client payload shape).
    const created = listingFromCreatePayload(LISTING_ID, {
      title: 'Mountain Bike',
      description: 'Light trail bike',
      price: 250,
      imageUrls: ['https://example.com/bike.jpg'],
      sellerId: SELLER_ID,
      sellerName: 'Sam Seller',
      communityIds: ['all'],
      primaryCategoryId: 'sports',
      categoryIds: ['sports'],
    });
    expect(created.status).toBe('active');
    expect(created).not.toHaveProperty('depositAmount');
    expect(created).not.toHaveProperty('paymentIntentId');

    // 2) Browse indexes a summary-only hit.
    const browse = summarizeBrowseSearchResult({
      listings: [created],
      total: 1,
      page: 1,
      pageSize: 24,
      hasMore: false,
      engine: 'typesense',
    });
    const card = browse.listings[0]!;
    expect(card).not.toHaveProperty('description');
    expect(isListingAvailableForBrowse(card.status)).toBe(true);

    // 3) Detail / bookmark can use summary or full listing interchangeably.
    const detail = makeFullListing();
    expect(toListingSummary(detail).id).toBe(card.id);
    expect(saveListing(BUYER_ID, card, 111).saved).toBe(true);
    expect(isListingSaved(BUYER_ID, LISTING_ID)).toBe(true);
    expect(getSavedListings(BUYER_ID)[0]?.price).toBe(250);

    // 4) Buyer messages seller from detail (optimistic + conversation grouping).
    const buyerMessage = createOptimisticMessage(
      LISTING_ID,
      BUYER_ID,
      'Buyer Bob',
      'Still available?',
      SELLER_ID,
    );
    expect(resolveBuyerFromMessage(detail, buyerMessage)).toBe(BUYER_ID);
    const conversations = groupMessagesByBuyer([buyerMessage], SELLER_ID);
    expect(conversations).toHaveLength(1);
    expect(
      filterMessagesForParticipant([buyerMessage], SELLER_ID, BUYER_ID),
    ).toHaveLength(1);

    // 5) Selling tab sees a buyer thread; archive/unread rules hold.
    const sellerThread = makeThread({
      id: sellerThreadDocId(LISTING_ID, BUYER_ID),
      buyerId: BUYER_ID,
      lastMessageText: buyerMessage.text,
      lastMessageSenderId: BUYER_ID,
    });
    expect(sellerThread.id).toBe(inboxStateDocId(LISTING_ID, BUYER_ID));
    expect(countBuyerThreadsForListing([sellerThread], LISTING_ID)).toBe(1);

    const states = new Map<string, InboxState>();
    expect(isThreadUnread(sellerThread, states, SELLER_ID)).toBe(true);
    expect(isThreadUnread(sellerThread, states, BUYER_ID)).toBe(false);

    states.set(inboxStateDocId(LISTING_ID, BUYER_ID), {
      listingId: LISTING_ID,
      buyerId: BUYER_ID,
      hasViewed: true,
      isArchived: true,
    });
    const partitioned = partitionByArchive([sellerThread], states);
    expect(partitioned.active).toHaveLength(0);
    expect(partitioned.archived).toHaveLength(1);
    expect(isThreadUnread(sellerThread, states, SELLER_ID)).toBe(false);

    // 6) Buyer can unsave after messaging; chain leaves no payment side effects.
    expect(toggleSavedListing(BUYER_ID, detail).saved).toBe(false);
    expect(getSavedListings(BUYER_ID)).toEqual([]);
  });
});
