import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearListingPrefsIfUserChanged,
  clearSavedListings,
  getSavedListingTombstones,
  getSavedListings,
  isListingSaved,
  saveListing,
  SAVED_LISTINGS_MAX,
  setSavedListings,
  setSavedListingsState,
  toggleSavedListing,
  unsaveListing,
} from '@/features/listings/services/savedListings';
import { getRecentListings, recordRecentListing } from '@/features/listings/services/recentListings';
import {
  getListingPrefsOwnerUid,
  setListingPrefsOwnerUid,
} from '@/features/listings/services/listingPrefsStorage';
import type { ListingSummary } from '@/types';

const storage = new Map<string, string>();

function listing(id: string): ListingSummary {
  return {
    id,
    title: `Listing ${id}`,
    price: 50,
    imageUrl: `https://example.com/${id}.jpg`,
    status: 'active',
    sellerId: 'seller-1',
    communityIds: ['all'],
    primaryCategoryId: 'general',
  };
}

describe('savedListings', () => {
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

  it('saves and unsaves a listing', () => {
    const saved = saveListing('user-a', listing('a'));
    expect(saved.saved).toBe(true);
    expect(isListingSaved('user-a', 'a')).toBe(true);

    unsaveListing('user-a', 'a');
    expect(isListingSaved('user-a', 'a')).toBe(false);
    expect(getSavedListings('user-a')).toEqual([]);
  });

  it('toggles saved state', () => {
    expect(toggleSavedListing('user-a', listing('a')).saved).toBe(true);
    expect(toggleSavedListing('user-a', listing('a')).saved).toBe(false);
  });

  it('enforces SAVED_LISTINGS_MAX', () => {
    for (let index = 0; index < SAVED_LISTINGS_MAX; index += 1) {
      expect(saveListing('user-a', listing(`saved-${index}`)).saved).toBe(true);
    }

    const atCapacity = saveListing('user-a', listing('overflow'));
    expect(atCapacity.saved).toBe(false);
    expect(getSavedListings('user-a')).toHaveLength(SAVED_LISTINGS_MAX);
  });

  it('clears previous owner prefs on user switch', () => {
    recordRecentListing('user-a', listing('recent-a'));
    saveListing('user-a', listing('saved-a'));

    clearListingPrefsIfUserChanged('user-b');

    expect(getRecentListings('user-a')).toEqual([]);
    expect(getSavedListings('user-a')).toEqual([]);
    expect(getListingPrefsOwnerUid()).toBe('user-b');
  });

  it('clears saved listings for a user', () => {
    saveListing('user-a', listing('a'));
    clearSavedListings('user-a');
    expect(getSavedListings('user-a')).toEqual([]);
  });

  it('replaces the full saved list via setSavedListings', () => {
    saveListing('user-a', listing('a'));
    setSavedListings('user-a', [
      {
        id: 'b',
        title: 'Listing b',
        price: 12,
        imageUrl: 'https://example.com/b.jpg',
        savedAt: 99,
      },
    ]);
    expect(getSavedListings('user-a').map((entry) => entry.id)).toEqual(['b']);
    expect(isListingSaved('user-a', 'a')).toBe(false);
  });

  it('records a tombstone on unsave and clears it on save', () => {
    saveListing('user-a', listing('a'), 10);
    unsaveListing('user-a', 'a', 55);
    expect(getSavedListings('user-a')).toEqual([]);
    expect(getSavedListingTombstones('user-a')).toEqual([{ id: 'a', deletedAt: 55 }]);

    saveListing('user-a', listing('a'), 80);
    expect(isListingSaved('user-a', 'a')).toBe(true);
    expect(getSavedListingTombstones('user-a')).toEqual([]);
  });

  it('keeps the newer tombstone when unsaving twice', () => {
    unsaveListing('user-a', 'ghost', 10);
    unsaveListing('user-a', 'ghost', 40);
    expect(getSavedListingTombstones('user-a')).toEqual([{ id: 'ghost', deletedAt: 40 }]);
  });

  it('writes entries and tombstones together via setSavedListingsState', () => {
    setSavedListingsState(
      'user-a',
      [
        {
          id: 'keep',
          title: 'Keep',
          price: 1,
          imageUrl: 'https://example.com/keep.jpg',
          savedAt: 1,
        },
      ],
      [
        { id: 'gone', deletedAt: 9 },
        { id: 'keep', deletedAt: 99 }, // ignored because listing is saved
      ],
    );

    expect(getSavedListings('user-a').map((entry) => entry.id)).toEqual(['keep']);
    expect(getSavedListingTombstones('user-a')).toEqual([{ id: 'gone', deletedAt: 9 }]);
  });
});

