/** Fraction of scroll distance at which lazy-reveal paints more in-memory items. */
export const SCROLL_REVEAL_THRESHOLD = 0.75;

/** @deprecated Prefer SCROLL_REVEAL_THRESHOLD — kept for tests referencing legacy name. */
export const DEFAULT_SCROLL_LOAD_THRESHOLD = SCROLL_REVEAL_THRESHOLD;

export function scrollProgress(scrollEl: Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'>): number {
  const scrollableHeight = scrollEl.scrollHeight - scrollEl.clientHeight;
  if (scrollableHeight <= 0) {
    return 1;
  }

  return scrollEl.scrollTop / scrollableHeight;
}

export function shouldLoadMoreAtScroll(
  scrollEl: Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'>,
  threshold = DEFAULT_SCROLL_LOAD_THRESHOLD,
): boolean {
  return scrollProgress(scrollEl) >= threshold;
}
