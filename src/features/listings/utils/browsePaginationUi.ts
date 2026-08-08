import { LISTINGS_PAGE_SIZE } from '@/features/listings/utils/listingMapper';
import { incompleteRowSlots } from '@/features/listings/utils/browseGridLayout';
import type { Listing } from '@/types';

export interface FeedPendingSkeletonInput {
  loading: boolean;
  showSkeletons: boolean;
  loadingMore: boolean;
  /** Background revalidation (e.g. debounced search) — hide row placeholders. */
  refreshing?: boolean;
  feedHasMore: boolean;
  allItemsRevealed: boolean;
  trailingSkeletonCount: number;
  /** Cards grid: fill incomplete row while waiting for the next feed page. */
  gridColumnCount?: number;
  visibleListingCount?: number;
}

export interface BrowseEndOfListInput {
  error: boolean;
  loading: boolean;
  showResultsLoading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  initialLoadPending: boolean;
  feedHasMore: boolean;
  allItemsRevealed: boolean;
  isScrollable: boolean;
  atBottom: boolean;
}

export interface CombinedTrailingSkeletonInput extends FeedPendingSkeletonInput {
  loadingMore: boolean;
}

/** Placeholder rows while waiting for the next feed page (lazy reveal caught up). */
export function feedPendingSkeletonCount(input: FeedPendingSkeletonInput): number {
  if (
    input.loading ||
    input.showSkeletons ||
    input.loadingMore ||
    input.refreshing ||
    !input.feedHasMore ||
    !input.allItemsRevealed
  ) {
    return 0;
  }

  const incompleteRow =
    input.gridColumnCount && input.gridColumnCount > 1 && input.visibleListingCount != null
      ? incompleteRowSlots(input.visibleListingCount, input.gridColumnCount)
      : 0;

  if (incompleteRow > 0) {
    return incompleteRow;
  }

  return Math.min(3, Math.max(1, Math.ceil(input.trailingSkeletonCount || 1)));
}

export function combinedTrailingSkeletonCount(input: CombinedTrailingSkeletonInput): number {
  if (input.loadingMore) {
    return 0;
  }

  return Math.max(input.trailingSkeletonCount, feedPendingSkeletonCount(input));
}

/** End copy only when feed is exhausted, all in-memory rows are revealed, and user is at the bottom. */
export function shouldShowBrowseEndOfList(input: BrowseEndOfListInput): boolean {
  return (
    !input.error &&
    !input.loading &&
    !input.showResultsLoading &&
    !input.loadingMore &&
    !input.refreshing &&
    !input.initialLoadPending &&
    !input.feedHasMore &&
    input.allItemsRevealed &&
    input.isScrollable &&
    input.atBottom
  );
}

export interface LoadMoreBlockedInput {
  feedHasMore: boolean;
  loadingMore: boolean;
  loading: boolean;
  refreshing: boolean;
  initialLoadPending: boolean;
  filterApplying: boolean;
  loadMoreLock: boolean;
}

export function isLoadMoreBlocked(input: LoadMoreBlockedInput): boolean {
  return (
    !input.feedHasMore ||
    input.loadingMore ||
    input.loading ||
    input.refreshing ||
    input.initialLoadPending ||
    input.filterApplying ||
    input.loadMoreLock
  );
}

export function resolveCachedBrowseHasMore(
  hasMore: boolean,
  listingCount: number,
  pageSize = LISTINGS_PAGE_SIZE,
): boolean {
  if (hasMore) {
    return true;
  }

  // Session cache omits Firestore cursors; a full first page may still have more results.
  return listingCount >= pageSize;
}

/** Infer more pages when the BFF returned a full page but hasMore was false (Firestore fallback cap). */
export function resolveBffBrowseHasMore(
  hasMore: boolean,
  listingCount: number,
  pageSize = LISTINGS_PAGE_SIZE,
): boolean {
  if (hasMore) {
    return true;
  }

  return listingCount >= pageSize;
}

/** Append feed/search results without duplicating listing IDs already in memory. */
export function appendBrowseListings(existing: Listing[], incoming: Listing[]): Listing[] {
  if (incoming.length === 0) {
    return existing;
  }

  const seen = new Set(existing.map((listing) => listing.id));
  const uniqueIncoming = incoming.filter((listing) => !seen.has(listing.id));
  if (uniqueIncoming.length === 0) {
    return existing;
  }

  return [...existing, ...uniqueIncoming];
}

/** Whether Firestore feed pagination should continue after the first page. */
export function resolveFirestoreFeedHasMore(
  pageHasMore: boolean,
  geoActive: boolean,
  bffBrowseEnabled: boolean,
): boolean {
  if (geoActive && !bffBrowseEnabled) {
    return false;
  }

  return pageHasMore;
}
