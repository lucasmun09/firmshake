import { describe, expect, it } from 'vitest';

import {
  combinedTrailingSkeletonCount,
  feedPendingSkeletonCount,
  isLoadMoreBlocked,
  appendBrowseListings,
  resolveBffBrowseHasMore,
  resolveCachedBrowseHasMore,
  resolveFirestoreFeedHasMore,
  shouldShowBrowseEndOfList,
} from '@/features/listings/utils/browsePaginationUi';

describe('browsePaginationUi', () => {
  describe('feedPendingSkeletonCount', () => {
    const base = {
      loading: false,
      showSkeletons: false,
      loadingMore: false,
      feedHasMore: true,
      allItemsRevealed: true,
      trailingSkeletonCount: 0,
    };

    it('shows placeholders when feed has more pages and lazy reveal is caught up', () => {
      expect(feedPendingSkeletonCount(base)).toBe(1);
    });

    it('hides card-grid placeholders — use load-more spinner instead', () => {
      expect(
        feedPendingSkeletonCount({
          ...base,
          gridColumnCount: 5,
          visibleListingCount: 18,
        }),
      ).toBe(0);
    });

    it('hides placeholders while loading more or when feed is exhausted', () => {
      expect(feedPendingSkeletonCount({ ...base, loadingMore: true })).toBe(0);
      expect(feedPendingSkeletonCount({ ...base, feedHasMore: false })).toBe(0);
      expect(feedPendingSkeletonCount({ ...base, allItemsRevealed: false })).toBe(0);
    });

    it('hides placeholders during background refresh (e.g. debounced search)', () => {
      expect(feedPendingSkeletonCount({ ...base, refreshing: true })).toBe(0);
    });
  });

  describe('combinedTrailingSkeletonCount', () => {
    it('hides all trailing placeholders while a feed page is loading', () => {
      expect(
        combinedTrailingSkeletonCount({
          loading: false,
          showSkeletons: false,
          loadingMore: true,
          feedHasMore: true,
          allItemsRevealed: true,
          trailingSkeletonCount: 4,
        }),
      ).toBe(0);
    });

    it('uses the larger of lazy-reveal and feed-pending counts', () => {
      expect(
        combinedTrailingSkeletonCount({
          loading: false,
          showSkeletons: false,
          loadingMore: false,
          feedHasMore: true,
          allItemsRevealed: false,
          trailingSkeletonCount: 3,
        }),
      ).toBe(3);
    });
  });

  describe('shouldShowBrowseEndOfList', () => {
    const base = {
      error: false,
      loading: false,
      showResultsLoading: false,
      loadingMore: false,
      refreshing: false,
      initialLoadPending: false,
      feedHasMore: false,
      allItemsRevealed: true,
      isScrollable: true,
      atBottom: true,
    };

    it('requires bottom reach, scrollability, and exhausted feed', () => {
      expect(shouldShowBrowseEndOfList(base)).toBe(true);
      expect(shouldShowBrowseEndOfList({ ...base, atBottom: false })).toBe(false);
      expect(shouldShowBrowseEndOfList({ ...base, feedHasMore: true })).toBe(false);
      expect(shouldShowBrowseEndOfList({ ...base, allItemsRevealed: false })).toBe(false);
      expect(shouldShowBrowseEndOfList({ ...base, isScrollable: false })).toBe(false);
    });

    it('waits until background refresh and initial load finish', () => {
      expect(shouldShowBrowseEndOfList({ ...base, refreshing: true })).toBe(false);
      expect(shouldShowBrowseEndOfList({ ...base, initialLoadPending: true })).toBe(false);
    });
  });

  describe('isLoadMoreBlocked', () => {
    const ready = {
      feedHasMore: true,
      loadingMore: false,
      loading: false,
      refreshing: false,
      initialLoadPending: false,
      filterApplying: false,
      loadMoreLock: false,
    };

    it('blocks pagination during refresh and initial load', () => {
      expect(isLoadMoreBlocked(ready)).toBe(false);
      expect(isLoadMoreBlocked({ ...ready, refreshing: true })).toBe(true);
      expect(isLoadMoreBlocked({ ...ready, initialLoadPending: true })).toBe(true);
      expect(isLoadMoreBlocked({ ...ready, filterApplying: true })).toBe(true);
    });
  });

  describe('resolveFirestoreFeedHasMore', () => {
    it('keeps server pagination when BFF geo search is enabled', () => {
      expect(resolveFirestoreFeedHasMore(true, true, true)).toBe(true);
    });

    it('stops legacy client-side geo feeds after the first page', () => {
      expect(resolveFirestoreFeedHasMore(true, true, false)).toBe(false);
      expect(resolveFirestoreFeedHasMore(true, false, false)).toBe(true);
    });
  });

  describe('resolveCachedBrowseHasMore', () => {
    it('assumes more pages when cache stored a full page without a cursor', () => {
      expect(resolveCachedBrowseHasMore(false, 24)).toBe(true);
      expect(resolveCachedBrowseHasMore(false, 10)).toBe(false);
      expect(resolveCachedBrowseHasMore(true, 10)).toBe(true);
    });
  });

  describe('resolveBffBrowseHasMore', () => {
    it('keeps pagination when API returns a full page with hasMore false', () => {
      expect(resolveBffBrowseHasMore(false, 24)).toBe(true);
      expect(resolveBffBrowseHasMore(false, 10)).toBe(false);
      expect(resolveBffBrowseHasMore(true, 24)).toBe(true);
    });
  });

  describe('appendBrowseListings', () => {
    it('skips duplicate listing IDs when appending pages', () => {
      const existing = [{ id: 'a' }, { id: 'b' }] as never[];
      const incoming = [{ id: 'b' }, { id: 'c' }] as never[];
      expect(appendBrowseListings(existing, incoming).map((item) => item.id)).toEqual(['a', 'b', 'c']);
    });

    it('appends all unique listings without a session cap', () => {
      const existing = Array.from({ length: 500 }, (_, index) => ({ id: `id-${index}` })) as never[];
      const incoming = [{ id: 'new-1' }, { id: 'new-2' }] as never[];
      expect(appendBrowseListings(existing, incoming)).toHaveLength(502);
      expect(appendBrowseListings(existing, incoming).at(-1)?.id).toBe('new-2');
    });
  });
});
