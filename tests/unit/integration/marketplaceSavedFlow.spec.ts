import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setListingPrefsOwnerUid } from '@/features/listings/services/listingPrefsStorage';
import {
  getSavedListings,
  isListingSaved,
  saveListing,
  toggleSavedListing,
  unsaveListing,
} from '@/features/listings/services/savedListings';
import {
  mergeSavedListingEntries,
  savedListingsMissingFromRemote,
} from '@/features/listings/services/savedListingsMerge';
import { toListingSummary } from '@/features/listings/utils/listingSummary';
import { summarizeBrowseSearchResult } from '@/features/listings/services/browseSearchSummary';

import {
  BUYER_ID,
  LISTING_ID,
  makeFullListing,
  makeSavedEntry,
  stubLocalStorage,
} from './marketplaceFixtures';

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

describe('integration — browse → detail → saved contracts', () => {
  beforeEach(() => {
    stubLocalStorage();
    setListingPrefsOwnerUid(BUYER_ID);
    fetchRemote.mockReset();
    upsertRemote.mockReset();
    deleteRemote.mockReset();
    canSyncRemote.mockReset();
    canSyncRemote.mockReturnValue(true);
    upsertRemote.mockResolvedValue(undefined);
    deleteRemote.mockResolvedValue(undefined);
  });

  it('saves a browse-summary shaped listing without requiring full detail fields', () => {
    const full = makeFullListing();
    const summarized = summarizeBrowseSearchResult({
      listings: [full],
      total: 1,
      page: 1,
      pageSize: 24,
      hasMore: false,
    });
    const summary = summarized.listings[0]!;

    const result = saveListing(BUYER_ID, summary, 100);
    expect(result.saved).toBe(true);
    expect(isListingSaved(BUYER_ID, LISTING_ID)).toBe(true);
    expect(getSavedListings(BUYER_ID)[0]).toMatchObject({
      id: LISTING_ID,
      title: 'Mountain Bike',
      price: 250,
      imageUrl: full.imageUrl,
      savedAt: 100,
    });
  });

  it('toggles save from a detail Listing and unsaves cleanly', () => {
    const listing = makeFullListing();
    expect(toggleSavedListing(BUYER_ID, listing).saved).toBe(true);
    expect(isListingSaved(BUYER_ID, LISTING_ID)).toBe(true);

    expect(toggleSavedListing(BUYER_ID, listing).saved).toBe(false);
    expect(isListingSaved(BUYER_ID, LISTING_ID)).toBe(false);
    expect(getSavedListings(BUYER_ID)).toEqual([]);
  });

  it('hydrates by merging remote + local and pushing local-only bookmarks', async () => {
    saveListing(BUYER_ID, toListingSummary(makeFullListing()), 100);
    fetchRemote.mockResolvedValue([makeSavedEntry({ id: 'remote-only', savedAt: 200 })]);

    const { hydrateSavedListingsFromRemote } = await import(
      '@/features/listings/services/savedListingsSync'
    );
    const merged = await hydrateSavedListingsFromRemote(BUYER_ID);

    expect(merged.map((entry) => entry.id).sort()).toEqual([LISTING_ID, 'remote-only'].sort());
    expect(upsertRemote).toHaveBeenCalledWith(
      BUYER_ID,
      expect.objectContaining({ id: LISTING_ID }),
    );
    expect(getSavedListings(BUYER_ID)).toHaveLength(2);
  });

  it('keeps newer savedAt on merge conflicts and reports remote gaps', () => {
    const local = [makeSavedEntry({ savedAt: 300, title: 'Local title' })];
    const remote = [makeSavedEntry({ savedAt: 100, title: 'Remote title' })];
    const merged = mergeSavedListingEntries(local, remote);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.title).toBe('Local title');
    expect(savedListingsMissingFromRemote(merged, remote)).toEqual([]);
    expect(
      savedListingsMissingFromRemote(
        [...merged, makeSavedEntry({ id: 'only-local', savedAt: 50 })],
        remote,
      ),
    ).toHaveLength(1);
  });

  it('rejects saving beyond the 50-entry cap without dropping existing rows', () => {
    for (let index = 0; index < 50; index += 1) {
      const ok = saveListing(
        BUYER_ID,
        toListingSummary(makeFullListing({ id: `listing-${index}`, title: `L${index}` })),
        index,
      );
      expect(ok.saved).toBe(true);
    }

    const overflow = saveListing(
      BUYER_ID,
      toListingSummary(makeFullListing({ id: 'listing-overflow', title: 'Overflow' })),
      999,
    );
    expect(overflow.saved).toBe(false);
    expect(getSavedListings(BUYER_ID)).toHaveLength(50);
    expect(isListingSaved(BUYER_ID, 'listing-overflow')).toBe(false);

    unsaveListing(BUYER_ID, 'listing-0');
    expect(getSavedListings(BUYER_ID)).toHaveLength(49);
  });
});
