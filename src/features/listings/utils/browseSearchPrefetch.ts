import {
  appendBrowseListings,
  resolveBffBrowseHasMore,
} from '@/features/listings/utils/browsePaginationUi';
import {
  BROWSE_OUTRUN_BUFFER_THRESHOLD,
  BROWSE_REVEAL_PREFETCH_THRESHOLD,
  BROWSE_SEARCH_PREFETCH_PAGES,
  BROWSE_SEARCH_SCROLL_BUFFER_AHEAD,
  BROWSE_TEXT_SEARCH_PAGE_SIZE,
  BROWSE_TEXT_SEARCH_PREFETCH_PAGES,
  LISTINGS_PAGE_SIZE,
} from '@/features/listings/utils/browsePaginationConfig';
import { browseSearchInitialPrefetchTarget } from '@/features/listings/utils/browsePrefetchGuards';
import type { Listing } from '@/types';

export {
  BROWSE_OUTRUN_BUFFER_THRESHOLD,
  BROWSE_REVEAL_PREFETCH_THRESHOLD,
  BROWSE_SEARCH_PREFETCH_PAGES,
  BROWSE_SEARCH_SCROLL_BUFFER_AHEAD,
  BROWSE_TEXT_SEARCH_PAGE_SIZE,
  BROWSE_TEXT_SEARCH_PREFETCH_PAGES,
} from '@/features/listings/utils/browsePaginationConfig';

export { browseSearchInitialPrefetchTarget };

/** Whether to silently prefetch pages 2+ after the first search page. */
export function shouldPrefetchBrowseSearchBuffer(_hasTextQuery = false): boolean {
  return true;
}

export interface BrowseSearchPageSlice {
  listings: Listing[];
  hasMore: boolean;
  page: number;
}

export interface BrowseLoadMoreSpinnerContext {
  visibleCount: number;
  fetchedCount: number;
  hasMore: boolean;
  outrunThreshold?: number;
}

/** Show spinner only when the user has revealed most of the fetched pool. */
export function shouldShowBrowseLoadMoreSpinner(
  context: BrowseLoadMoreSpinnerContext,
): boolean {
  if (!context.hasMore) {
    return false;
  }

  if (context.fetchedCount <= 0) {
    return true;
  }

  const threshold = context.outrunThreshold ?? BROWSE_OUTRUN_BUFFER_THRESHOLD;
  return context.visibleCount / context.fetchedCount >= threshold;
}

/** Whether scroll position or reveal progress warrants a silent feed prefetch. */
export function shouldTriggerBrowseFeedPrefetch(
  scrollEl: Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'>,
  visibleCount: number,
  fetchedCount: number,
  scrollThreshold = BROWSE_REVEAL_PREFETCH_THRESHOLD,
): boolean {
  if (fetchedCount <= 0) {
    return false;
  }

  const scrollableHeight = scrollEl.scrollHeight - scrollEl.clientHeight;
  const scrollReady =
    scrollableHeight <= 0 ||
    scrollEl.scrollTop / scrollableHeight >= scrollThreshold;

  return (
    scrollReady ||
    shouldPrefetchBrowseFeedByRevealProgress(visibleCount, fetchedCount, scrollThreshold)
  );
}

/** Prefetch when the user has scrolled through enough of the in-memory feed. */
export function shouldPrefetchBrowseFeedByRevealProgress(
  visibleCount: number,
  fetchedCount: number,
  threshold = BROWSE_REVEAL_PREFETCH_THRESHOLD,
): boolean {
  if (fetchedCount <= 0 || visibleCount <= 0) {
    return false;
  }

  return visibleCount / fetchedCount >= threshold;
}

/** Page numbers to fetch silently after the first page (e.g. [2, 3] when target is 3). */
export function nextBrowseSearchPagesToPrefetch(
  loadedPage: number,
  hasMore: boolean,
  targetPages = BROWSE_SEARCH_PREFETCH_PAGES,
): number[] {
  if (!hasMore || loadedPage >= targetPages) {
    return [];
  }

  const pages: number[] = [];
  for (let page = loadedPage + 1; page <= targetPages; page += 1) {
    pages.push(page);
  }
  return pages;
}

/** Page numbers needed to keep `pagesAhead` pages fetched beyond `loadedPage`. */
export function browseSearchPagesToMaintainBuffer(
  loadedPage: number,
  hasMore: boolean,
  pagesAhead = BROWSE_SEARCH_SCROLL_BUFFER_AHEAD,
): number[] {
  if (!hasMore || pagesAhead <= 0) {
    return [];
  }

  const targetPage = loadedPage + pagesAhead;
  const pages: number[] = [];
  for (let page = loadedPage + 1; page <= targetPage; page += 1) {
    pages.push(page);
  }
  return pages;
}

/** Append a search page, dedupe by listing id, and infer hasMore from page fill. */
export function applyBrowseSearchPageResult(
  existing: Listing[],
  result: Pick<BrowseSearchPageSlice, 'listings' | 'hasMore'>,
  pageSize = LISTINGS_PAGE_SIZE,
): { listings: Listing[]; hasMore: boolean; appendedCount: number } {
  const listings = appendBrowseListings(existing, result.listings);
  return {
    listings,
    hasMore: resolveBffBrowseHasMore(
      result.hasMore,
      result.listings.length,
      pageSize,
    ),
    appendedCount: listings.length - existing.length,
  };
}
