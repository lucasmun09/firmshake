import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getListingsByIds = vi.fn();

vi.mock('@/features/listings/services/listings', () => ({
  getListingsByIds: (...args: unknown[]) => getListingsByIds(...args),
}));

vi.mock('@/utils/apiBaseUrl', () => ({
  normalizeImageUrl: (url: string) => url,
}));

import { enrichThreads } from '@/features/messages/services/threadModel';
import {
  clearThreadEnrichCache,
  getThreadEnrichListing,
} from '@/features/messages/services/threadEnrichCache';
import type { MessageThread } from '@/types';

function thread(overrides: Partial<MessageThread> = {}): MessageThread {
  return {
    id: 'listing-1',
    listingId: 'listing-1',
    listingTitle: 'Stale',
    listingImageUrl: '',
    sellerId: '',
    sellerName: '',
    lastMessageText: 'hi',
    lastMessageSenderId: 'buyer-1',
    lastMessageSenderName: 'Buyer',
    ...overrides,
  };
}

describe('enrichThreads + threadEnrichCache', () => {
  beforeEach(() => {
    clearThreadEnrichCache();
    getListingsByIds.mockReset();
  });

  afterEach(() => {
    clearThreadEnrichCache();
  });

  it('fetches missing listings once then serves enrich from cache', async () => {
    getListingsByIds.mockResolvedValue(
      new Map([
        [
          'listing-1',
          {
            id: 'listing-1',
            title: 'Fresh Bike',
            imageUrl: '/bike.jpg',
            sellerId: 'seller-1',
            sellerName: 'Sam',
            status: 'active',
          },
        ],
      ]),
    );

    const first = await enrichThreads([thread()]);
    expect(first[0]?.listingTitle).toBe('Fresh Bike');
    expect(getListingsByIds).toHaveBeenCalledTimes(1);
    expect(getThreadEnrichListing('listing-1')?.title).toBe('Fresh Bike');

    getListingsByIds.mockClear();
    const second = await enrichThreads([thread({ listingTitle: 'ignored' })]);
    expect(second[0]?.listingTitle).toBe('Fresh Bike');
    expect(getListingsByIds).not.toHaveBeenCalled();
  });

  it('only fetches ids missing from the enrich cache', async () => {
    getListingsByIds
      .mockResolvedValueOnce(
        new Map([
          [
            'listing-1',
            {
              id: 'listing-1',
              title: 'A',
              imageUrl: '',
              sellerId: 's',
              sellerName: 'S',
              status: 'active',
            },
          ],
        ]),
      )
      .mockResolvedValueOnce(
        new Map([
          [
            'listing-2',
            {
              id: 'listing-2',
              title: 'B',
              imageUrl: '',
              sellerId: 's',
              sellerName: 'S',
              status: 'sold',
            },
          ],
        ]),
      );

    await enrichThreads([thread({ id: 'listing-1', listingId: 'listing-1' })]);
    await enrichThreads([
      thread({ id: 'listing-1', listingId: 'listing-1' }),
      thread({ id: 'listing-2', listingId: 'listing-2' }),
    ]);

    expect(getListingsByIds).toHaveBeenNthCalledWith(2, ['listing-2'], { preferCache: true });
  });
});
