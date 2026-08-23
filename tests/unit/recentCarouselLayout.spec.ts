import { describe, expect, it } from 'vitest';

import { getRecentCarouselSlotCount } from '@/features/listings/utils/recentCarouselLayout';

describe('recentCarouselLayout', () => {
  it('uses 2x grid columns in cards view', () => {
    expect(getRecentCarouselSlotCount('cards', 3, 1024)).toBe(6);
    expect(getRecentCarouselSlotCount('cards', 1, 375)).toBe(2);
  });

  it('uses responsive slot counts in map view', () => {
    expect(getRecentCarouselSlotCount('map', 3, 1200)).toBe(6);
    expect(getRecentCarouselSlotCount('map', 3, 800)).toBe(5);
    expect(getRecentCarouselSlotCount('map', 3, 500)).toBe(4);
    expect(getRecentCarouselSlotCount('map', 3, 360)).toBe(3);
  });

  it('falls back to four slots in list view', () => {
    expect(getRecentCarouselSlotCount('list', 3, 1024)).toBe(4);
  });
});
