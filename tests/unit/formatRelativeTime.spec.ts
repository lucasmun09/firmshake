import { describe, expect, it } from 'vitest';

import { formatRelativeTime } from '@/common/utils/formatRelativeTime';

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-11-05T22:00:00.000Z');

  it('formats recent times relatively', () => {
    expect(formatRelativeTime(now - 15_000, now)).toBe('just now');
    expect(formatRelativeTime(now - 90_000, now)).toBe('1 minute ago');
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5 minutes ago');
    expect(formatRelativeTime(now - 2 * 60 * 60_000, now)).toBe('2 hours ago');
    expect(formatRelativeTime(now - 2 * 24 * 60 * 60_000, now)).toBe('2 days ago');
  });

  it('falls back to a date for older timestamps', () => {
    const older = now - 14 * 24 * 60 * 60_000;
    expect(formatRelativeTime(older, now)).toMatch(/\d/);
  });
});
