import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearRecentListings,
  getRecentListings,
  recordRecentListing,
  RECENT_LISTINGS_MAX,
} from '@/features/listings/services/recentListings';
import {
  getListingPrefsOwnerUid,
  setListingPrefsOwnerUid,
} from '@/features/listings/services/listingPrefsStorage';
import type { ListingSummary } from '@/types';

const storage = new Map<string, string>();

function listing(id: string, title = `Listing ${id}`): ListingSummary {
  return {
    id,
    title,
    price: 100,
    imageUrl: `https://example.com/${id}.jpg`,
    status: 'active',
    sellerId: 'seller-1',
    communityIds: ['all'],
    primaryCategoryId: 'general',
  };
}

describe('recentListings', () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    });
    setListingPrefsOwnerUid('user-a');
  });

  it('records a listing with newest first and snapshot fields', () => {
    recordRecentListing('user-a', listing('a'));
    recordRecentListing('user-a', listing('b'));

    const entries = getRecentListings('user-a');
    expect(entries.map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(entries[0]).toMatchObject({
      id: 'b',
      title: 'Listing b',
      price: 100,
      imageUrl: 'https://example.com/b.jpg',
    });
    expect(entries[0]?.viewedAt).toEqual(expect.any(Number));
  });

  it('moves an existing listing to the front without duplicates', () => {
    recordRecentListing('user-a', listing('a'));
    recordRecentListing('user-a', listing('b'));
    recordRecentListing('user-a', listing('a'));

    expect(getRecentListings('user-a').map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('caps stored recents at RECENT_LISTINGS_MAX', () => {
    for (let index = 0; index < RECENT_LISTINGS_MAX + 5; index += 1) {
      recordRecentListing('user-a', listing(`item-${index}`));
    }

    expect(getRecentListings('user-a')).toHaveLength(RECENT_LISTINGS_MAX);
    expect(getRecentListings('user-a')[0]?.id).toBe(`item-${RECENT_LISTINGS_MAX + 4}`);
  });

  it('clears recents for a user', () => {
    recordRecentListing('user-a', listing('a'));
    clearRecentListings('user-a');
    expect(getRecentListings('user-a')).toEqual([]);
  });

  it('uses per-user storage keys', () => {
    recordRecentListing('user-a', listing('a'));
    recordRecentListing('user-b', listing('b'));

    expect(getRecentListings('user-a').map((entry) => entry.id)).toEqual(['a']);
    expect(getRecentListings('user-b').map((entry) => entry.id)).toEqual(['b']);
    expect(getListingPrefsOwnerUid()).toBe('user-a');
  });
});
