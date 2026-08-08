/** Fraction of total scroll distance (0–1) past which the next page should load. */
export const DEFAULT_SCROLL_LOAD_THRESHOLD = 0.75;

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
