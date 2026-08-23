/**
 * Central browse pagination & read-budget constants.
 * Import from here instead of scattering magic numbers across browse modules.
 */

export { LISTINGS_PAGE_SIZE } from '@/features/listings/utils/listingMapper';
export { SCROLL_REVEAL_THRESHOLD } from '@/common/utils/scrollLoadThreshold';

/** Smaller first fetch for keyword search — faster time-to-results. */
export const BROWSE_TEXT_SEARCH_PAGE_SIZE = 12;

/** Initial silent prefetch depth inclusive of page 1 (browse / community feed). */
export const BROWSE_SEARCH_PREFETCH_PAGES = 3;

/** Initial silent prefetch depth for keyword search. */
export const BROWSE_TEXT_SEARCH_PREFETCH_PAGES = 2;

/** Pages to keep fetched ahead of the highest loaded page while scrolling. */
export const BROWSE_SEARCH_SCROLL_BUFFER_AHEAD = 2;

/** Reveal ratio (visible ÷ fetched) that triggers silent feed prefetch. */
export const BROWSE_REVEAL_PREFETCH_THRESHOLD = 0.55;

/** Cards grid prefetches earlier — dense viewport exhausts the in-memory buffer faster. */
export const BROWSE_CARDS_REVEAL_PREFETCH_THRESHOLD = 0.4;

/** Reveal ratio at which the user has outrun the prefetch buffer (show spinner). */
export const BROWSE_OUTRUN_BUFFER_THRESHOLD = 0.85;

/** Map viewport search page size (sidebar radius bucket). */
export const BROWSE_MAP_SEARCH_PAGE_SIZE = 100;

/** Max pages fetched per map viewport load (radius bucket). */
export const BROWSE_MAP_MAX_PREFETCH_PAGES = 3;

/** Debounce rapid text-search filter changes to avoid stacked BFF requests. */
export const BROWSE_SEARCH_DEBOUNCE_MS = 250;
