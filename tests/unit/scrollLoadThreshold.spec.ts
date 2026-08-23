import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SCROLL_LOAD_THRESHOLD,
  SCROLL_REVEAL_THRESHOLD,
  scrollProgress,
  shouldLoadMoreAtScroll,
} from '@/common/utils/scrollLoadThreshold';

function mockScrollEl(scrollTop: number, scrollHeight: number, clientHeight: number) {
  return { scrollTop, scrollHeight, clientHeight };
}

describe('scrollLoadThreshold', () => {
  it('returns 0 at top and 1 at bottom', () => {
    const el = mockScrollEl(0, 5000, 800);
    expect(scrollProgress(el)).toBe(0);

    el.scrollTop = 4200;
    expect(scrollProgress(el)).toBe(1);
  });

  it('returns 1 when content is not scrollable', () => {
    expect(scrollProgress(mockScrollEl(0, 800, 800))).toBe(1);
    expect(scrollProgress(mockScrollEl(0, 600, 800))).toBe(1);
  });

  it('triggers lazy reveal at 75% of full list scroll distance', () => {
    const el = mockScrollEl(0, 5000, 800);
    const scrollable = el.scrollHeight - el.clientHeight;

    el.scrollTop = scrollable * 0.74;
    expect(shouldLoadMoreAtScroll(el, DEFAULT_SCROLL_LOAD_THRESHOLD)).toBe(false);

    el.scrollTop = scrollable * 0.75;
    expect(shouldLoadMoreAtScroll(el, DEFAULT_SCROLL_LOAD_THRESHOLD)).toBe(true);

    el.scrollTop = scrollable * 0.9;
    expect(shouldLoadMoreAtScroll(el, DEFAULT_SCROLL_LOAD_THRESHOLD)).toBe(true);
  });

  it('does not use viewport-height remaining distance (long lists)', () => {
    const el = mockScrollEl(3150, 5000, 800);
    const scrollable = el.scrollHeight - el.clientHeight;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    expect(remaining).toBeGreaterThan(el.clientHeight * 0.75);
    expect(el.scrollTop / scrollable).toBeGreaterThanOrEqual(0.75);
    expect(shouldLoadMoreAtScroll(el, DEFAULT_SCROLL_LOAD_THRESHOLD)).toBe(true);
  });

  it('exports aligned reveal threshold constants', () => {
    expect(SCROLL_REVEAL_THRESHOLD).toBe(0.75);
    expect(DEFAULT_SCROLL_LOAD_THRESHOLD).toBe(SCROLL_REVEAL_THRESHOLD);
  });
});
