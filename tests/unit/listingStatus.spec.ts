import { beforeEach, describe, expect, it, vi } from 'vitest';

const getListingById = vi.fn();
const removeListingFromAllBrowseLocalCaches = vi.fn();

vi.mock('@/features/listings/services/listings', () => ({
  getListingById: (...args: unknown[]) => getListingById(...args),
}));

vi.mock('@/features/listings/services/browseLocalStorageCache', () => ({
  removeListingFromAllBrowseLocalCaches: (...args: unknown[]) =>
    removeListingFromAllBrowseLocalCaches(...args),
}));

import {
  fetchListingStatus,
  isListingAvailableForBrowse,
  validateListingAvailability,
} from '@/features/listings/services/listingStatus';

describe('listingStatus', () => {
  beforeEach(() => {
    getListingById.mockReset();
    removeListingFromAllBrowseLocalCaches.mockReset();
  });

  it('treats only active listings as available', () => {
    expect(isListingAvailableForBrowse('active')).toBe(true);
    expect(isListingAvailableForBrowse('sold')).toBe(false);
    expect(isListingAvailableForBrowse('removed')).toBe(false);
  });

  it('returns listing status from Firestore', async () => {
    getListingById.mockResolvedValue({ id: 'a', status: 'sold' });

    await expect(fetchListingStatus('a')).resolves.toBe('sold');
    expect(getListingById).toHaveBeenCalledWith('a', {
      preferCache: true,
      preferServer: true,
    });
  });

  it('busts browse caches when listing is unavailable', async () => {
    getListingById.mockResolvedValue({ id: 'a', status: 'removed' });

    await expect(validateListingAvailability('a')).resolves.toBe(false);
    expect(removeListingFromAllBrowseLocalCaches).toHaveBeenCalledWith('a');
  });

  it('busts browse caches when listing is missing', async () => {
    getListingById.mockResolvedValue(null);

    await expect(validateListingAvailability('missing')).resolves.toBe(false);
    expect(removeListingFromAllBrowseLocalCaches).toHaveBeenCalledWith('missing');
  });

  it('keeps available listings in cache', async () => {
    getListingById.mockResolvedValue({ id: 'a', status: 'active' });

    await expect(validateListingAvailability('a')).resolves.toBe(true);
    expect(removeListingFromAllBrowseLocalCaches).not.toHaveBeenCalled();
  });
});
