import {
  appendBrowseListings,
  resolveBffBrowseHasMore,
} from '@/features/listings/utils/browsePaginationUi';
import { LISTINGS_PAGE_SIZE } from '@/features/listings/utils/listingMapper';
import type { Listing } from '@/types';

/** Total page-based search pages to buffer before scroll-triggered fetch (inclusive of page 1). */
export const BROWSE_SEARCH_PREFETCH_PAGES = 3;

/** Smaller first fetch for keyword search — faster time-to-results. */
export const BROWSE_TEXT_SEARCH_PAGE_SIZE = 12;

/** Whether to silently prefetch pages 2+ after the first search page. */
export function shouldPrefetchBrowseSearchBuffer(hasTextQuery: boolean): boolean {
  return !hasTextQuery;
}

export interface BrowseSearchPageSlice {
  listings: Listing[];
  hasMore: boolean;
  page: number;
}

/** Whether scroll pagination should show the bottom loading spinner for this page. */
export function shouldShowBrowseLoadMoreSpinner(
  page: number,
  prefetchPages = BROWSE_SEARCH_PREFETCH_PAGES,
): boolean {
  return page > prefetchPages;
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

/** Append a search page, dedupe by listing id, and infer hasMore from page fill. */
export function applyBrowseSearchPageResult(
  existing: Listing[],
  result: Pick<BrowseSearchPageSlice, 'listings' | 'hasMore'>,
  pageSize = LISTINGS_PAGE_SIZE,
): { listings: Listing[]; hasMore: boolean; appendedCount: number } {
  const listings = appendBrowseListings(existing, result.listings);
  return {
    listings,
    hasMore: resolveBffBrowseHasMore(result.hasMore, result.listings.length, pageSize),
    appendedCount: listings.length - existing.length,
  };
}
