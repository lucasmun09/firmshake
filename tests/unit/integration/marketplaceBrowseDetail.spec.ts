import { describe, expect, it, vi } from 'vitest';

import {
  listingsFromBrowseSummaryResult,
  summarizeBrowseSearchResult,
} from '@/features/listings/services/browseSearchSummary';
import {
  isListingAvailableForBrowse,
  validateListingAvailability,
} from '@/features/listings/services/listingStatus';
import {
  listingSummaryToListing,
  toListingSummary,
} from '@/features/listings/utils/listingSummary';

import { LISTING_ID, makeFullListing } from './marketplaceFixtures';

const getListingById = vi.fn();
const removeListingFromAllBrowseLocalCaches = vi.fn();

vi.mock('@/features/listings/services/listings', () => ({
  getListingById: (...args: unknown[]) => getListingById(...args),
}));

vi.mock('@/features/listings/services/browseLocalStorageCache', () => ({
  removeListingFromAllBrowseLocalCaches: (...args: unknown[]) =>
    removeListingFromAllBrowseLocalCaches(...args),
}));

describe('integration — browse → detail contracts', () => {
  it('strips browse hits to summaries then revives list rows without detail fields', () => {
    const full = makeFullListing();
    const summarized = summarizeBrowseSearchResult({
      listings: [full],
      total: 1,
      page: 1,
      pageSize: 24,
      hasMore: false,
      engine: 'typesense',
    });

    expect(summarized.listings).toHaveLength(1);
    expect(summarized.listings[0]).not.toHaveProperty('description');
    expect(summarized.listings[0]).not.toHaveProperty('imageUrls');
    expect(summarized.listings[0]?.sellerId).toBe(full.sellerId);
    expect(summarized.listings[0]?.price).toBe(250);

    const revived = listingsFromBrowseSummaryResult(summarized);
    expect(revived[0]?.id).toBe(LISTING_ID);
    expect(revived[0]?.description).toBe('');
    expect(revived[0]?.sellerName).toBe('Unknown seller');
    expect(revived[0]?.imageUrls).toEqual([full.imageUrl]);
    expect(revived[0]?.status).toBe('active');
  });

  it('round-trips summary fields needed for detail routing and bookmarking', () => {
    const full = makeFullListing();
    const summary = toListingSummary(full);
    const cardAsListing = listingSummaryToListing(summary);

    expect(summary.id).toBe(LISTING_ID);
    expect(cardAsListing.id).toBe(LISTING_ID);
    expect(cardAsListing.sellerId).toBe(full.sellerId);
    expect(cardAsListing.primaryCategoryId).toBe('sports');
    expect(isListingAvailableForBrowse(cardAsListing.status)).toBe(true);
  });

  it('marks sold/removed browse rows unavailable and busts local caches on detail check', async () => {
    getListingById.mockReset();
    removeListingFromAllBrowseLocalCaches.mockReset();

    getListingById.mockResolvedValueOnce(makeFullListing({ status: 'sold' }));
    await expect(validateListingAvailability(LISTING_ID)).resolves.toBe(false);
    expect(removeListingFromAllBrowseLocalCaches).toHaveBeenCalledWith(LISTING_ID);

    getListingById.mockResolvedValueOnce(makeFullListing({ status: 'active' }));
    await expect(validateListingAvailability(LISTING_ID)).resolves.toBe(true);
  });

  it('fails closed when detail fetch returns null after a browse click', async () => {
    getListingById.mockReset();
    removeListingFromAllBrowseLocalCaches.mockReset();
    getListingById.mockResolvedValueOnce(null);

    await expect(validateListingAvailability('missing-id')).resolves.toBe(false);
    expect(removeListingFromAllBrowseLocalCaches).toHaveBeenCalledWith('missing-id');
  });
});
