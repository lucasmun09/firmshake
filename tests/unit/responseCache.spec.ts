import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildCacheKey,
  clearResponseCache,
  getCached,
  getStaleCached,
  initResponseCacheOnPageLoad,
  isHardPageReload,
  setCached,
} from '@/common/services/responseCache';

describe('responseCache', () => {
  beforeEach(() => {
    clearResponseCache();
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds stable keys from query params', () => {
    expect(
      buildCacheKey('listing-search', {
        community: 'abc',
        category: '',
        page: 1,
        q: 'desk',
      }),
    ).toBe('listing-search:community=abc&page=1&q=desk');
  });

  it('returns cached values until TTL expires', () => {
    setCached('communities:tab=all', [{ id: 'all', name: 'All' }], 300_000);

    expect(getCached('communities:tab=all')).toEqual([{ id: 'all', name: 'All' }]);

    vi.advanceTimersByTime(299_999);
    expect(getCached('communities:tab=all')).toEqual([{ id: 'all', name: 'All' }]);

    vi.advanceTimersByTime(2);
    expect(getCached('communities:tab=all')).toBeNull();
  });

  it('returns stale values after TTL for boot hydration', () => {
    setCached('communities:tab=all', [{ id: 'all', name: 'All' }], 300_000);

    vi.advanceTimersByTime(301_000);
    expect(getCached('communities:tab=all')).toBeNull();
    expect(getStaleCached('communities:tab=all')).toEqual([{ id: 'all', name: 'All' }]);
  });

  it('hydrates memory from sessionStorage on hard reload', () => {
    sessionStorage.setItem(
      'firmshake-cache:communities:tab=all',
      JSON.stringify({
        data: [{ id: 'all', name: 'All' }],
        expiresAt: Date.now() + 300_000,
      }),
    );

    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      { type: 'reload' } as PerformanceNavigationTiming,
    ]);

    expect(isHardPageReload()).toBe(true);
    initResponseCacheOnPageLoad();
    expect(getStaleCached('communities:tab=all')).toEqual([{ id: 'all', name: 'All' }]);
  });
});
