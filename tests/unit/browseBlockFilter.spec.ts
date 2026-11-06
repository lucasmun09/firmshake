import { describe, expect, it } from 'vitest';

import {
  applyBrowseBlockListFilter,
  excludeListingsByBlockedSellers,
  excludePinGroupsByBlockedSellers,
  toBlockedSellerIdSet,
} from '@/features/listings/utils/browseBlockFilter';

describe('browseBlockFilter', () => {
  it('builds a trimmed blocked-seller set', () => {
    expect([...toBlockedSellerIdSet([' a ', '', 'b', 'a'])].sort()).toEqual(['a', 'b']);
    expect(toBlockedSellerIdSet(null).size).toBe(0);
  });

  it('excludes listings whose seller is blocked', () => {
    const listings = [
      { id: '1', sellerId: 'good' },
      { id: '2', sellerId: 'blocked-1' },
      { id: '3', sellerId: '' },
      { id: '4' },
    ];

    expect(excludeListingsByBlockedSellers(listings, ['blocked-1']).map((row) => row.id)).toEqual([
      '1',
      '3',
      '4',
    ]);
  });

  it('returns the same array reference when the block list is empty', () => {
    const listings = [{ id: '1', sellerId: 'a' }];
    expect(excludeListingsByBlockedSellers(listings, [])).toBe(listings);
  });

  it('excludes pin groups for blocked sellers', () => {
    const groups = [
      { sellerId: 'good', listingIds: ['1'], lat: 1, lng: 2, count: 1 },
      { sellerId: 'blocked-1', listingIds: ['2', '3'], lat: 3, lng: 4, count: 2 },
    ];

    expect(excludePinGroupsByBlockedSellers(groups, ['blocked-1'])).toEqual([groups[0]]);
  });

  it('applies listings + pinGroups together', () => {
    const result = applyBrowseBlockListFilter(
      {
        listings: [
          { id: '1', sellerId: 'good' },
          { id: '2', sellerId: 'blocked-1' },
        ],
        pinGroups: [
          { sellerId: 'good', listingIds: ['1'], lat: 1, lng: 1, count: 1 },
          { sellerId: 'blocked-1', listingIds: ['2'], lat: 2, lng: 2, count: 1 },
        ],
      },
      ['blocked-1'],
    );

    expect(result.listings.map((row) => row.id)).toEqual(['1']);
    expect(result.pinGroups?.map((group) => group.sellerId)).toEqual(['good']);
  });
});
