/** Visible mini-card slots in the browse recent carousel (2× grid columns). */
export function getRecentCarouselSlotCount(
  viewMode: 'cards' | 'map' | 'list',
  gridColumnCount: number,
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024,
): number {
  if (viewMode === 'map') {
    if (viewportWidth >= 1024) {
      return 6;
    }
    if (viewportWidth >= 768) {
      return 5;
    }
    if (viewportWidth >= 480) {
      return 4;
    }
    return 3;
  }

  if (viewMode === 'cards') {
    return Math.max(2, gridColumnCount * 2);
  }

  return 4;
}
