import {
  BROWSE_SEARCH_SCROLL_BUFFER_AHEAD,
  BROWSE_TEXT_SEARCH_PREFETCH_PAGES,
  BROWSE_SEARCH_PREFETCH_PAGES,
} from '@/features/listings/utils/browsePaginationConfig';

/** Highest page number allowed for silent scroll-buffer prefetch. */
export function maxBrowseScrollPrefetchPage(
  loadedPage: number,
  pagesAhead = BROWSE_SEARCH_SCROLL_BUFFER_AHEAD,
): number {
  return loadedPage + pagesAhead;
}

/** Whether a page fetch stays within the scroll prefetch depth (silent buffer only). */
export function isBrowseSearchPageWithinScrollPrefetchDepth(
  loadedPage: number,
  targetPage: number,
  pagesAhead = BROWSE_SEARCH_SCROLL_BUFFER_AHEAD,
): boolean {
  return targetPage > loadedPage && targetPage <= maxBrowseScrollPrefetchPage(loadedPage, pagesAhead);
}

/** Initial silent prefetch target (page count inclusive of page 1). */
export function browseSearchInitialPrefetchTarget(hasTextQuery: boolean): number {
  return hasTextQuery ? BROWSE_TEXT_SEARCH_PREFETCH_PAGES : BROWSE_SEARCH_PREFETCH_PAGES;
}

/** Allow silent prefetch when within scroll buffer and initial text-search cap (if applicable). */
export function canSilentlyPrefetchBrowseSearchPage(
  loadedPage: number,
  targetPage: number,
  hasTextQuery: boolean,
): boolean {
  if (targetPage <= loadedPage) {
    return false;
  }

  if (!isBrowseSearchPageWithinScrollPrefetchDepth(loadedPage, targetPage)) {
    return false;
  }

  const initialTarget = browseSearchInitialPrefetchTarget(hasTextQuery);
  if (loadedPage < initialTarget && targetPage > initialTarget) {
    return false;
  }

  return true;
}
