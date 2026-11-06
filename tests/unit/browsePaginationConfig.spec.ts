import { describe, expect, it } from 'vitest';

import {
  BROWSE_CARDS_REVEAL_PREFETCH_THRESHOLD,
  BROWSE_MAP_MAX_PREFETCH_PAGES,
  BROWSE_REVEAL_PREFETCH_THRESHOLD,
  BROWSE_MAP_SEARCH_PAGE_SIZE,
  BROWSE_SEARCH_DEBOUNCE_MS,
  BROWSE_SEARCH_PREFETCH_PAGES,
  BROWSE_SEARCH_SCROLL_BUFFER_AHEAD,
  BROWSE_TEXT_SEARCH_PREFETCH_PAGES,
  LISTINGS_PAGE_SIZE,
} from '@/features/listings/utils/browsePaginationConfig';

describe('browsePaginationConfig', () => {
  it('exports stable page-size and prefetch depth constants', () => {
    expect(LISTINGS_PAGE_SIZE).toBeGreaterThanOrEqual(24);
    expect(LISTINGS_PAGE_SIZE).toBeLessThanOrEqual(50);
    expect(BROWSE_MAP_SEARCH_PAGE_SIZE).toBe(100);
    expect(BROWSE_MAP_MAX_PREFETCH_PAGES).toBe(3);
    expect(BROWSE_SEARCH_SCROLL_BUFFER_AHEAD).toBe(2);
    expect(BROWSE_SEARCH_PREFETCH_PAGES).toBeGreaterThan(BROWSE_TEXT_SEARCH_PREFETCH_PAGES);
    expect(BROWSE_SEARCH_DEBOUNCE_MS).toBeGreaterThan(0);
    expect(BROWSE_CARDS_REVEAL_PREFETCH_THRESHOLD).toBeLessThan(
      BROWSE_REVEAL_PREFETCH_THRESHOLD,
    );
  });
});
