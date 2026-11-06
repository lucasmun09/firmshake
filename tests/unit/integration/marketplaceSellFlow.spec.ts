import { beforeEach, describe, expect, it, vi } from 'vitest';

import { summarizeBrowseSearchResult } from '@/features/listings/services/browseSearchSummary';
import { listingFromCreatePayload } from '@/features/listings/services/listingFeed';
import { isListingAvailableForBrowse } from '@/features/listings/services/listingStatus';
import { toListingSummary } from '@/features/listings/utils/listingSummary';
import {
  countBuyerThreadsForListing,
  sellerThreadDocId,
} from '@/features/messages/services/threadModel';
import type { Listing, UserProfile } from '@/types';

import {
  BUYER_ID,
  LISTING_ID,
  SELLER_ID,
  makeFullListing,
  makeThread,
} from './marketplaceFixtures';

const useBffListings = vi.fn(() => false);
const createListingBff = vi.fn();
const createListingFirestore = vi.fn();
const updateListingBff = vi.fn();
const updateListingFirestore = vi.fn();
const removeListingBff = vi.fn();
const removeListingFirestore = vi.fn();
const markListingSoldBff = vi.fn();
const markListingSoldFirestore = vi.fn();
const getListingById = vi.fn();

vi.mock('@/common/config/featureFlags', () => ({
  useBffListings: () => useBffListings(),
  useBffMessages: () => false,
  useBffAgreements: () => false,
  useBffUsers: () => false,
  useBffInbox: () => false,
  useBffBrowse: () => true,
}));

vi.mock('@/features/listings/services/listingBff', () => ({
  createListing: (...args: unknown[]) => createListingBff(...args),
  updateListing: (...args: unknown[]) => updateListingBff(...args),
  removeListing: (...args: unknown[]) => removeListingBff(...args),
  markListingSold: (...args: unknown[]) => markListingSoldBff(...args),
}));

vi.mock('@/features/listings/services/listingFirestoreWrites', () => ({
  createListing: (...args: unknown[]) => createListingFirestore(...args),
  updateListing: (...args: unknown[]) => updateListingFirestore(...args),
  removeListing: (...args: unknown[]) => removeListingFirestore(...args),
  markListingSold: (...args: unknown[]) => markListingSoldFirestore(...args),
}));

vi.mock('@/features/listings/services/listings', () => ({
  getListingById: (...args: unknown[]) => getListingById(...args),
}));

vi.mock('@/utils/moderation', () => ({
  canRemoveListing: () => true,
  canMarkListingSold: () => true,
}));

const seller: UserProfile = {
  uid: SELLER_ID,
  email: 'seller@example.com',
  firstName: 'Sam',
  lastName: 'Seller',
  displayName: 'Sam Seller',
  communityIds: ['all'],
  isAdmin: false,
  isSuperAdmin: false,
  moderatorCommunityIds: [],
};

describe('integration — sell → browse → messaging contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBffListings.mockReturnValue(false);
  });

  it('create payload becomes an active listing that browse summaries can index', () => {
    const created = listingFromCreatePayload(LISTING_ID, {
      title: 'Mountain Bike',
      description: 'Light trail bike',
      price: 250,
      imageUrls: ['https://example.com/bike.jpg', ''],
      sellerId: SELLER_ID,
      sellerName: 'Sam Seller',
      communityIds: ['all'],
      primaryCategoryId: 'sports',
      categoryIds: ['sports'],
    });

    expect(created.status).toBe('active');
    expect(created.imageUrl).toBe('https://example.com/bike.jpg');
    expect(created.imageUrls).toEqual(['https://example.com/bike.jpg']);
    expect(isListingAvailableForBrowse(created.status)).toBe(true);

    const browse = summarizeBrowseSearchResult({
      listings: [created],
      total: 1,
      page: 1,
      pageSize: 24,
      hasMore: false,
    });
    expect(browse.listings[0]).toEqual(toListingSummary(created));
  });

  it('routes create/remove through Firestore when BFF listings flag is off', async () => {
    const createdListing = makeFullListing();
    createListingFirestore.mockResolvedValue(createdListing);
    getListingById.mockResolvedValue(createdListing);
    removeListingFirestore.mockResolvedValue({ ...createdListing, status: 'removed' });

    const { routeCreateListing, routeRemoveListing } = await import(
      '@/features/listings/services/listingServiceRouter'
    );

    const input = {
      title: 'Mountain Bike',
      description: 'Light trail bike',
      price: 250,
      imageUrls: ['https://example.com/bike.jpg'],
      sellerId: SELLER_ID,
      sellerName: 'Sam Seller',
      communityIds: ['all'],
      primaryCategoryId: 'sports',
      categoryIds: ['sports'],
    };

    await expect(routeCreateListing(input)).resolves.toMatchObject({ id: LISTING_ID, status: 'active' });
    expect(createListingFirestore).toHaveBeenCalledWith(input);
    expect(createListingBff).not.toHaveBeenCalled();

    await expect(routeRemoveListing(LISTING_ID, seller)).resolves.toMatchObject({
      status: 'removed',
    });
    expect(removeListingFirestore).toHaveBeenCalled();
    expect(removeListingBff).not.toHaveBeenCalled();
  });

  it('blocks remove when listing is already inactive', async () => {
    getListingById.mockResolvedValue(makeFullListing({ status: 'sold' }));
    const { routeRemoveListing } = await import(
      '@/features/listings/services/listingServiceRouter'
    );

    await expect(routeRemoveListing(LISTING_ID, seller)).rejects.toThrow(
      /no longer active/i,
    );
  });

  it('counts seller buyer-threads for a listing after messaging starts', () => {
    const threads = [
      makeThread({
        id: sellerThreadDocId(LISTING_ID, BUYER_ID),
        buyerId: BUYER_ID,
      }),
      makeThread({
        id: sellerThreadDocId(LISTING_ID, 'buyer-2'),
        buyerId: 'buyer-2',
        lastMessageSenderId: 'buyer-2',
      }),
      makeThread({
        id: 'other-listing',
        listingId: 'other-listing',
        buyerId: BUYER_ID,
      }),
    ];

    expect(countBuyerThreadsForListing(threads, LISTING_ID)).toBe(2);
    expect(countBuyerThreadsForListing(threads, 'missing')).toBe(0);
  });

  it('keeps removed listings out of browse availability after sell takedown', () => {
    const removed: Listing = makeFullListing({ status: 'removed' });
    expect(isListingAvailableForBrowse(removed.status)).toBe(false);

    const browse = summarizeBrowseSearchResult({
      listings: [removed],
      total: 1,
      page: 1,
      pageSize: 24,
      hasMore: false,
    });
    expect(isListingAvailableForBrowse(browse.listings[0]!.status)).toBe(false);
  });

  it('routes mark-sold through Firestore and drops sold from browse availability', async () => {
    const active = makeFullListing();
    getListingById.mockResolvedValue(active);
    markListingSoldFirestore.mockResolvedValue({ ...active, status: 'sold' });

    const { routeMarkListingSold } = await import(
      '@/features/listings/services/listingServiceRouter'
    );

    const sold = await routeMarkListingSold(LISTING_ID, seller);
    expect(sold.status).toBe('sold');
    expect(markListingSoldFirestore).toHaveBeenCalledWith(LISTING_ID, seller, active);
    expect(markListingSoldBff).not.toHaveBeenCalled();
    expect(isListingAvailableForBrowse(sold.status)).toBe(false);
  });
});
