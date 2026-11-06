import { describe, expect, it } from 'vitest';

import {
  BROWSE_SEARCH_SCROLL_BUFFER_AHEAD,
} from '@/features/listings/utils/browsePaginationConfig';
import {
  canSilentlyPrefetchBrowseSearchPage,
  isBrowseSearchPageWithinScrollPrefetchDepth,
  maxBrowseScrollPrefetchPage,
} from '@/features/listings/utils/browsePrefetchGuards';

describe('browsePrefetchGuards', () => {
  describe('maxBrowseScrollPrefetchPage', () => {
    it('allows two pages ahead of the loaded page by default', () => {
      expect(maxBrowseScrollPrefetchPage(3)).toBe(5);
      expect(maxBrowseScrollPrefetchPage(3, BROWSE_SEARCH_SCROLL_BUFFER_AHEAD)).toBe(5);
    });
  });

  describe('isBrowseSearchPageWithinScrollPrefetchDepth', () => {
    it('accepts pages within the scroll buffer', () => {
      expect(isBrowseSearchPageWithinScrollPrefetchDepth(3, 4)).toBe(true);
      expect(isBrowseSearchPageWithinScrollPrefetchDepth(3, 5)).toBe(true);
    });

    it('rejects pages beyond the scroll buffer or already loaded', () => {
      expect(isBrowseSearchPageWithinScrollPrefetchDepth(3, 6)).toBe(false);
      expect(isBrowseSearchPageWithinScrollPrefetchDepth(3, 3)).toBe(false);
      expect(isBrowseSearchPageWithinScrollPrefetchDepth(3, 2)).toBe(false);
    });
  });

  describe('canSilentlyPrefetchBrowseSearchPage', () => {
    it('allows initial browse buffer pages 2–3 after page 1', () => {
      expect(canSilentlyPrefetchBrowseSearchPage(1, 2, false)).toBe(true);
      expect(canSilentlyPrefetchBrowseSearchPage(1, 3, false)).toBe(true);
      expect(canSilentlyPrefetchBrowseSearchPage(1, 4, false)).toBe(false);
    });

    it('allows a smaller initial buffer for keyword search', () => {
      expect(canSilentlyPrefetchBrowseSearchPage(1, 2, true)).toBe(true);
      expect(canSilentlyPrefetchBrowseSearchPage(1, 3, true)).toBe(false);
    });

    it('allows scroll-buffer pages while deep in the feed', () => {
      expect(canSilentlyPrefetchBrowseSearchPage(10, 11, false)).toBe(true);
      expect(canSilentlyPrefetchBrowseSearchPage(10, 12, false)).toBe(true);
      expect(canSilentlyPrefetchBrowseSearchPage(10, 13, false)).toBe(false);
    });
  });
});
