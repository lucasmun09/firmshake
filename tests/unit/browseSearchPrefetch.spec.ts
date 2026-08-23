import { describe, expect, it } from 'vitest';

import {
  applyBrowseSearchPageResult,
  BROWSE_OUTRUN_BUFFER_THRESHOLD,
  BROWSE_REVEAL_PREFETCH_THRESHOLD,
  BROWSE_SEARCH_PREFETCH_PAGES,
  BROWSE_SEARCH_SCROLL_BUFFER_AHEAD,
  BROWSE_TEXT_SEARCH_PAGE_SIZE,
  BROWSE_TEXT_SEARCH_PREFETCH_PAGES,
  browseSearchInitialPrefetchTarget,
  browseSearchPagesToMaintainBuffer,
  nextBrowseSearchPagesToPrefetch,
  shouldPrefetchBrowseFeedByRevealProgress,
  shouldPrefetchBrowseSearchBuffer,
  shouldShowBrowseLoadMoreSpinner,
  shouldTriggerBrowseFeedPrefetch,
} from '@/features/listings/utils/browseSearchPrefetch';

function mockScrollEl(scrollTop: number, scrollHeight: number, clientHeight: number) {
  return { scrollTop, scrollHeight, clientHeight };
}

describe('browseSearchPrefetch', () => {
  describe('shouldPrefetchBrowseSearchBuffer', () => {
    it('prefetches for browse and keyword search', () => {
      expect(shouldPrefetchBrowseSearchBuffer(true)).toBe(true);
      expect(shouldPrefetchBrowseSearchBuffer(false)).toBe(true);
    });
  });

  describe('browseSearchInitialPrefetchTarget', () => {
    it('uses a smaller initial buffer for keyword search', () => {
      expect(browseSearchInitialPrefetchTarget(true)).toBe(BROWSE_TEXT_SEARCH_PREFETCH_PAGES);
      expect(browseSearchInitialPrefetchTarget(false)).toBe(BROWSE_SEARCH_PREFETCH_PAGES);
    });
  });

  it('uses a smaller page size constant for text search', () => {
    expect(BROWSE_TEXT_SEARCH_PAGE_SIZE).toBeLessThanOrEqual(24);
    expect(BROWSE_TEXT_SEARCH_PAGE_SIZE).toBeGreaterThan(0);
  });

  describe('shouldShowBrowseLoadMoreSpinner', () => {
    it('hides the spinner while plenty of fetched listings remain unrevealed', () => {
      expect(
        shouldShowBrowseLoadMoreSpinner({
          visibleCount: 10,
          fetchedCount: 48,
          hasMore: true,
        }),
      ).toBe(false);
    });

    it('shows the spinner when the user has outrun the prefetch buffer', () => {
      expect(
        shouldShowBrowseLoadMoreSpinner({
          visibleCount: 42,
          fetchedCount: 48,
          hasMore: true,
        }),
      ).toBe(true);
    });

    it('respects a custom outrun threshold', () => {
      expect(
        shouldShowBrowseLoadMoreSpinner({
          visibleCount: 20,
          fetchedCount: 24,
          hasMore: true,
          outrunThreshold: 0.5,
        }),
      ).toBe(true);
    });
  });

  describe('shouldPrefetchBrowseFeedByRevealProgress', () => {
    it('triggers at 55% of fetched listings revealed', () => {
      expect(shouldPrefetchBrowseFeedByRevealProgress(10, 24)).toBe(false);
      expect(shouldPrefetchBrowseFeedByRevealProgress(13, 24)).toBe(false);
      expect(shouldPrefetchBrowseFeedByRevealProgress(14, 24)).toBe(true);
    });

    it('ignores empty counts', () => {
      expect(shouldPrefetchBrowseFeedByRevealProgress(0, 24)).toBe(false);
      expect(shouldPrefetchBrowseFeedByRevealProgress(10, 0)).toBe(false);
    });
  });

  describe('shouldTriggerBrowseFeedPrefetch', () => {
    it('triggers on scroll progress or reveal ratio', () => {
      const el = mockScrollEl(0, 5000, 800);
      const scrollable = el.scrollHeight - el.clientHeight;

      el.scrollTop = scrollable * (BROWSE_REVEAL_PREFETCH_THRESHOLD - 0.01);
      expect(shouldTriggerBrowseFeedPrefetch(el, 5, 48)).toBe(false);

      el.scrollTop = scrollable * BROWSE_REVEAL_PREFETCH_THRESHOLD;
      expect(shouldTriggerBrowseFeedPrefetch(el, 5, 48)).toBe(true);

      el.scrollTop = 0;
      expect(shouldTriggerBrowseFeedPrefetch(el, 28, 48)).toBe(true);
    });
  });

  describe('nextBrowseSearchPagesToPrefetch', () => {
    it('requests pages 2 and 3 after the first page when more results exist', () => {
      expect(
        nextBrowseSearchPagesToPrefetch(1, true, BROWSE_SEARCH_PREFETCH_PAGES),
      ).toEqual([2, 3]);
    });

    it('stops when the buffer is already loaded or the feed is exhausted', () => {
      expect(nextBrowseSearchPagesToPrefetch(3, true)).toEqual([]);
      expect(nextBrowseSearchPagesToPrefetch(1, false)).toEqual([]);
      expect(nextBrowseSearchPagesToPrefetch(2, true)).toEqual([3]);
    });
  });

  describe('browseSearchPagesToMaintainBuffer', () => {
    it('requests the next two pages to stay ahead while scrolling', () => {
      expect(browseSearchPagesToMaintainBuffer(3, true, BROWSE_SEARCH_SCROLL_BUFFER_AHEAD)).toEqual([
        4,
        5,
      ]);
    });

    it('returns nothing when the feed is exhausted', () => {
      expect(browseSearchPagesToMaintainBuffer(3, false)).toEqual([]);
    });
  });

  describe('applyBrowseSearchPageResult', () => {
    it('dedupes listings and infers hasMore from a full page', () => {
      const existing = [{ id: 'a' }] as never[];
      const incoming = Array.from({ length: 24 }, (_, index) => ({
        id: `p-${index}`,
      })) as never[];

      const result = applyBrowseSearchPageResult(
        existing,
        { listings: incoming, hasMore: false },
        24,
      );

      expect(result.listings.map((listing) => listing.id)).toEqual([
        'a',
        ...incoming.map((listing) => listing.id),
      ]);
      expect(result.appendedCount).toBe(24);
      expect(result.hasMore).toBe(true);
    });

    it('marks the feed exhausted when the page is short', () => {
      const existing = [{ id: 'a' }] as never[];
      const incoming = [{ id: 'b' }] as never[];

      expect(
        applyBrowseSearchPageResult(existing, { listings: incoming, hasMore: false }, 24),
      ).toEqual({
        listings: [{ id: 'a' }, { id: 'b' }],
        hasMore: false,
        appendedCount: 1,
      });
    });
  });

  it('exports stable threshold constants', () => {
    expect(BROWSE_REVEAL_PREFETCH_THRESHOLD).toBeGreaterThan(0.5);
    expect(BROWSE_REVEAL_PREFETCH_THRESHOLD).toBeLessThan(0.65);
    expect(BROWSE_OUTRUN_BUFFER_THRESHOLD).toBeGreaterThan(BROWSE_REVEAL_PREFETCH_THRESHOLD);
  });
});
