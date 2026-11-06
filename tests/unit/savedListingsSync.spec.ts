import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getSavedListings,
  saveListing,
  setSavedListings,
  type SavedListingEntry,
} from '@/features/listings/services/savedListings';
import { setListingPrefsOwnerUid } from '@/features/listings/services/listingPrefsStorage';
import type { ListingSummary } from '@/types';

const fetchRemote = vi.fn();
const upsertRemote = vi.fn();
const deleteRemote = vi.fn();
const canSyncRemote = vi.fn();

vi.mock('@/features/listings/services/savedListingsRemote', () => ({
  canSyncSavedListingsRemote: (...args: unknown[]) => canSyncRemote(...args),
  fetchSavedListingsRemote: (...args: unknown[]) => fetchRemote(...args),
  upsertSavedListingRemote: (...args: unknown[]) => upsertRemote(...args),
  deleteSavedListingRemote: (...args: unknown[]) => deleteRemote(...args),
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
    fetchRemote.mockReset();
    upsertRemote.mockReset();
    deleteRemote.mockReset();
    canSyncRemote.mockReset();
    canSyncRemote.mockReturnValue(true);
    upsertRemote.mockResolvedValue(undefined);
    deleteRemote.mockResolvedValue(undefined);
  });

  it('hydrates by merging remote into local and pushing local-only', async () => {
    saveListing('user-a', listing('local-only'), 100);
    fetchRemote.mockResolvedValue([entry('remote-only', 200)]);

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
    expect(fetchRemote).not.toHaveBeenCalled();
  });

  it('syncs toggle upsert and delete', async () => {
    const { syncSavedListingToggleRemote } = await import(
      '@/features/listings/services/savedListingsSync'
    );
    const saved = entry('a', 10);
    setSavedListings('user-a', [saved]);

    await syncSavedListingToggleRemote('user-a', 'a', true, saved);
    expect(upsertRemote).toHaveBeenCalledWith('user-a', saved);

    await syncSavedListingToggleRemote('user-a', 'a', false);
    expect(deleteRemote).toHaveBeenCalledWith('user-a', 'a');
  });
});
