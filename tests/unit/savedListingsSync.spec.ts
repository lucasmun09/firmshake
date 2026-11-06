import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getSavedListingTombstones,
  getSavedListings,
  saveListing,
  setSavedListings,
  unsaveListing,
  type SavedListingEntry,
} from '@/features/listings/services/savedListings';
import { setListingPrefsOwnerUid } from '@/features/listings/services/listingPrefsStorage';
import type { ListingSummary } from '@/types';

const fetchRemoteState = vi.fn();
const upsertRemote = vi.fn();
const tombstoneRemote = vi.fn();
const canSyncRemote = vi.fn();

vi.mock('@/features/listings/services/savedListingsRemote', () => ({
  canSyncSavedListingsRemote: (...args: unknown[]) => canSyncRemote(...args),
  fetchSavedListingsRemoteState: (...args: unknown[]) => fetchRemoteState(...args),
  fetchSavedListingsRemote: async (...args: unknown[]) =>
    (await fetchRemoteState(...args)).entries,
  upsertSavedListingRemote: (...args: unknown[]) => upsertRemote(...args),
  tombstoneSavedListingRemote: (...args: unknown[]) => tombstoneRemote(...args),
  deleteSavedListingRemote: (...args: unknown[]) => tombstoneRemote(...args),
}));

vi.mock('@/common/debug/debugLog', () => ({
  debugLog: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  serializeError: (error: unknown) => error,
}));

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

function entry(id: string, savedAt: number): SavedListingEntry {
  return {
    id,
    title: `Listing ${id}`,
    price: 50,
    imageUrl: `https://example.com/${id}.jpg`,
    savedAt,
  };
}

describe('savedListingsSync', () => {
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
    fetchRemoteState.mockReset();
    upsertRemote.mockReset();
    tombstoneRemote.mockReset();
    canSyncRemote.mockReset();
    canSyncRemote.mockReturnValue(true);
    upsertRemote.mockResolvedValue(undefined);
    tombstoneRemote.mockResolvedValue(undefined);
  });

  it('hydrates by merging remote into local and pushing local-only', async () => {
    saveListing('user-a', listing('local-only'), 100);
    fetchRemoteState.mockResolvedValue({
      entries: [entry('remote-only', 200)],
      tombstones: [],
    });

    const { hydrateSavedListingsFromRemote } = await import(
      '@/features/listings/services/savedListingsSync'
    );
    const merged = await hydrateSavedListingsFromRemote('user-a');

    expect(merged.map((item) => item.id)).toEqual(['remote-only', 'local-only']);
    expect(getSavedListings('user-a').map((item) => item.id)).toEqual([
      'remote-only',
      'local-only',
    ]);
    expect(upsertRemote).toHaveBeenCalledTimes(1);
    expect(upsertRemote.mock.calls[0][1].id).toBe('local-only');
    expect(tombstoneRemote).not.toHaveBeenCalled();
  });

  it('does not resurrect a locally unsaved listing from a stale remote save', async () => {
    saveListing('user-a', listing('a'), 50);
    unsaveListing('user-a', 'a', 300);
    expect(getSavedListingTombstones('user-a')).toEqual([{ id: 'a', deletedAt: 300 }]);

    fetchRemoteState.mockResolvedValue({
      entries: [entry('a', 100)],
      tombstones: [],
    });

    const { hydrateSavedListingsFromRemote } = await import(
      '@/features/listings/services/savedListingsSync'
    );
    const merged = await hydrateSavedListingsFromRemote('user-a');

    expect(merged).toEqual([]);
    expect(getSavedListings('user-a')).toEqual([]);
    expect(getSavedListingTombstones('user-a')).toEqual([{ id: 'a', deletedAt: 300 }]);
    expect(tombstoneRemote).toHaveBeenCalledWith('user-a', 'a', 300);
    expect(upsertRemote).not.toHaveBeenCalled();
  });

  it('applies a remote tombstone over a stale local save', async () => {
    saveListing('user-a', listing('a'), 40);
    fetchRemoteState.mockResolvedValue({
      entries: [],
      tombstones: [{ id: 'a', deletedAt: 90 }],
    });

    const { hydrateSavedListingsFromRemote } = await import(
      '@/features/listings/services/savedListingsSync'
    );
    const merged = await hydrateSavedListingsFromRemote('user-a');

    expect(merged).toEqual([]);
    expect(getSavedListings('user-a')).toEqual([]);
    expect(getSavedListingTombstones('user-a')).toEqual([{ id: 'a', deletedAt: 90 }]);
    expect(tombstoneRemote).not.toHaveBeenCalled();
    expect(upsertRemote).not.toHaveBeenCalled();
  });

  it('skips hydrate when sync is disabled', async () => {
    canSyncRemote.mockReturnValue(false);
    saveListing('user-a', listing('a'), 50);
    const { hydrateSavedListingsFromRemote } = await import(
      '@/features/listings/services/savedListingsSync'
    );
    const result = await hydrateSavedListingsFromRemote('user-a');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('a');
    expect(fetchRemoteState).not.toHaveBeenCalled();
  });

  it('syncs toggle upsert and tombstone delete', async () => {
    const { syncSavedListingToggleRemote } = await import(
      '@/features/listings/services/savedListingsSync'
    );
    const saved = entry('a', 10);
    setSavedListings('user-a', [saved]);

    await syncSavedListingToggleRemote('user-a', 'a', true, saved);
    expect(upsertRemote).toHaveBeenCalledWith('user-a', saved);

    unsaveListing('user-a', 'a', 77);
    await syncSavedListingToggleRemote('user-a', 'a', false);
    expect(tombstoneRemote).toHaveBeenCalledWith('user-a', 'a', 77);
  });
});
