import { describe, expect, it } from 'vitest';

import {
  applyBrowseSearchPageResult,
  BROWSE_SEARCH_PREFETCH_PAGES,
  BROWSE_TEXT_SEARCH_PAGE_SIZE,
  nextBrowseSearchPagesToPrefetch,
  shouldPrefetchBrowseSearchBuffer,
  shouldShowBrowseLoadMoreSpinner,
} from '@/features/listings/utils/browseSearchPrefetch';

describe('browseSearchPrefetch', () => {
  describe('shouldPrefetchBrowseSearchBuffer', () => {
    it('skips silent prefetch for keyword search', () => {
      expect(shouldPrefetchBrowseSearchBuffer(true)).toBe(false);
      expect(shouldPrefetchBrowseSearchBuffer(false)).toBe(true);
    });
  });

  it('uses a smaller page size constant for text search', () => {
    expect(BROWSE_TEXT_SEARCH_PAGE_SIZE).toBeLessThanOrEqual(24);
    expect(BROWSE_TEXT_SEARCH_PAGE_SIZE).toBeGreaterThan(0);
  });

  describe('shouldShowBrowseLoadMoreSpinner', () => {
    it('hides the spinner for the first buffered pages', () => {
      expect(shouldShowBrowseLoadMoreSpinner(1)).toBe(false);
      expect(shouldShowBrowseLoadMoreSpinner(2)).toBe(false);
      expect(shouldShowBrowseLoadMoreSpinner(3)).toBe(false);
      expect(shouldShowBrowseLoadMoreSpinner(4)).toBe(true);
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
});
