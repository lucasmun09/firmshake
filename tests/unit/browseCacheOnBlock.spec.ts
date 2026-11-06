import { beforeEach, describe, expect, it, vi } from 'vitest';

const invalidateBrowseSearchCache = vi.fn();
const invalidateAllBrowseFeedCache = vi.fn();
const removeSellerListingsFromAllBrowseLocalCaches = vi.fn(() => 2);
const debugInfo = vi.fn();

vi.mock('@/features/listings/services/browseSearch', () => ({
  invalidateBrowseSearchCache: (...args: unknown[]) => invalidateBrowseSearchCache(...args),
}));

vi.mock('@/features/listings/services/browseFeedCache', () => ({
  invalidateAllBrowseFeedCache: (...args: unknown[]) => invalidateAllBrowseFeedCache(...args),
}));

vi.mock('@/features/listings/services/browseLocalStorageCache', () => ({
  removeSellerListingsFromAllBrowseLocalCaches: (...args: unknown[]) =>
    removeSellerListingsFromAllBrowseLocalCaches(...args),
}));

vi.mock('@/common/debug/debugLog', () => ({
  debugLog: { info: (...args: unknown[]) => debugInfo(...args), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('bustBrowseCachesForBlockedSeller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    removeSellerListingsFromAllBrowseLocalCaches.mockReturnValue(2);
  });

  it('invalidates browse caches and strips local seller rows', async () => {
    const { bustBrowseCachesForBlockedSeller } = await import(
      '@/features/listings/services/browseCacheOnBlock'
    );

    bustBrowseCachesForBlockedSeller(' seller-9 ');

    expect(invalidateBrowseSearchCache).toHaveBeenCalledTimes(1);
    expect(invalidateAllBrowseFeedCache).toHaveBeenCalledTimes(1);
    expect(removeSellerListingsFromAllBrowseLocalCaches).toHaveBeenCalledWith('seller-9');
    expect(debugInfo).toHaveBeenCalledWith(
      'browse',
      'block.bustBrowseCaches',
      expect.objectContaining({ blockedSellerId: 'seller-9', localBucketsUpdated: 2 }),
    );
  });

  it('no-ops on empty seller id', async () => {
    const { bustBrowseCachesForBlockedSeller } = await import(
      '@/features/listings/services/browseCacheOnBlock'
    );

    bustBrowseCachesForBlockedSeller('   ');

    expect(invalidateBrowseSearchCache).not.toHaveBeenCalled();
    expect(removeSellerListingsFromAllBrowseLocalCaches).not.toHaveBeenCalled();
  });
});
