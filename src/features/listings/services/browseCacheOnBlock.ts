import { debugLog } from '@/common/debug/debugLog';
import { invalidateAllBrowseFeedCache } from '@/features/listings/services/browseFeedCache';
import { removeSellerListingsFromAllBrowseLocalCaches } from '@/features/listings/services/browseLocalStorageCache';
import { invalidateBrowseSearchCache } from '@/features/listings/services/browseSearch';

/**
 * After a successful block, drop cached browse rows for that seller so the next
 * paint (or Bearer-filtered BFF fetch) cannot resurface their listings.
 */
export function bustBrowseCachesForBlockedSeller(blockedSellerId: string): void {
  const sellerId = String(blockedSellerId ?? '').trim();
  if (!sellerId) {
    return;
  }

  invalidateBrowseSearchCache();
  invalidateAllBrowseFeedCache();

  const removed = removeSellerListingsFromAllBrowseLocalCaches(sellerId);
  debugLog.info('browse', 'block.bustBrowseCaches', {
    blockedSellerId: sellerId,
    localBucketsUpdated: removed,
  });
}
