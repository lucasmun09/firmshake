import { describe, expect, it } from 'vitest';

import type { BrowseSearchResult } from '@/features/listings/services/browseSearch';
import {
  listingsFromBrowseSummaryResult,
  summarizeBrowseSearchResult,
} from '@/features/listings/services/browseSearchSummary';
import type { Listing } from '@/types';

function makeListing(id: string): Listing {
  return {
    id,
    title: `Listing ${id}`,
    titleLower: `listing ${id}`,
    description: 'Long description',
    price: 10,
    imageUrl: 'https://example.com/a.jpg',
    imageUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
    sellerId: 'seller',
    sellerName: 'Seller',
    communityIds: ['all'],
    primaryCategoryId: 'general',
    categoryIds: ['general'],
    status: 'active',
  };
}

describe('browseSearchSummary', () => {
  it('summarizeBrowseSearchResult strips heavy listing fields before cache write', () => {
    const result: BrowseSearchResult = {
      listings: [makeListing('1')],
      total: 1,
      page: 1,
      pageSize: 24,
      hasMore: false,
      engine: 'typesense',
    };

    const summarized = summarizeBrowseSearchResult(result);

    expect(summarized.total).toBe(1);
    expect(summarized.listings[0]).not.toHaveProperty('description');
    expect(summarized.listings[0]).not.toHaveProperty('imageUrls');
    expect(summarized.listings[0]?.imageUrl).toBe('https://example.com/a.jpg');
  });

  it('summarizeBrowseSearchResult preserves pinGroups as listingIds summary', () => {
    const result: BrowseSearchResult = {
      listings: [
        {
          ...makeListing('1'),
          location: { lat: 38.75, lng: -77.47 },
        },
        {
          ...makeListing('2'),
          location: { lat: 38.7501, lng: -77.4701 },
        },
      ],
      total: 2,
      page: 1,
      pageSize: 24,
      hasMore: false,
      pinGroups: [
        {
          key: 'seller:38.7501:-77.4701',
          kind: 'aggregated',
          sellerId: 'seller',
          position: { lat: 38.75005, lng: -77.47005 },
          listings: [
            { ...makeListing('1'), location: { lat: 38.75, lng: -77.47 } },
            { ...makeListing('2'), location: { lat: 38.7501, lng: -77.4701 } },
          ],
        },
      ],
    };

    const summarized = summarizeBrowseSearchResult(result);

    expect(summarized.pinGroups).toEqual([
      {
        key: 'seller:38.7501:-77.4701',
        kind: 'aggregated',
        sellerId: 'seller',
        position: { lat: 38.75005, lng: -77.47005 },
        listingIds: ['1', '2'],
      },
    ]);
  });

  it('listingsFromBrowseSummaryResult revives summaries for browse UI', () => {
    const summarized = summarizeBrowseSearchResult({
      listings: [makeListing('2')],
      total: 1,
      page: 1,
      pageSize: 24,
      hasMore: false,
    });

    const listings = listingsFromBrowseSummaryResult(summarized);
    expect(listings[0]?.id).toBe('2');
    expect(listings[0]?.description).toBe('');
    expect(listings[0]?.imageUrls).toEqual(['https://example.com/a.jpg']);
  });
});
