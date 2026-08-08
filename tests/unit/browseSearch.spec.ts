import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useBffBrowse } from '@/common/config/featureFlags';

vi.mock('@/common/config/featureFlags', () => ({
  useBffBrowse: vi.fn(() => true),
}));

vi.mock('@/utils/apiBaseUrl', () => ({
  getApiBaseUrl: () => 'https://api.test',
  isApiConfigured: () => true,
}));

vi.mock('@/common/debug/loggedFetch', () => ({
  loggedFetch: vi.fn(async () => ({
    ok: true,
    json: async () => ({
      listings: [{ id: 'l1', title: 'Bike', price: 100, communityIds: ['all'], primaryCategoryId: 'general' }],
      total: 1,
      page: 1,
      pageSize: 24,
      hasMore: false,
      engine: 'firestore',
    }),
  })),
}));

vi.mock('@/common/services/api', () => ({
  authHeaders: vi.fn(async () => ({})),
}));

vi.mock('@/common/services/responseCache', () => ({
  buildCacheKey: (...parts: unknown[]) => JSON.stringify(parts),
  getCached: vi.fn(() => null),
  invalidateCached: vi.fn(),
  invalidateCachedNamespace: vi.fn(),
  setCached: vi.fn(),
}));

vi.mock('@/features/listings/utils/geoDebugLog', () => ({
  logListingSearchResults: vi.fn(),
}));

describe('browseSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts combined filters to BFF browse search', async () => {
    const { loggedFetch } = await import('@/common/debug/loggedFetch');
    const { searchBrowseListings, browseSearchCacheKey } = await import(
      '@/features/listings/services/browseSearch'
    );

    await searchBrowseListings({
      q: 'bike',
      communityId: 'all',
      categoryId: 'sports',
      priceMin: 10,
      priceMax: 500,
      lat: 38.75,
      lng: -77.47,
      radiusMiles: 25,
      sort: 'distance',
      page: 2,
    });

    expect(loggedFetch).toHaveBeenCalledWith(
      'https://api.test/api/v1/browse/search',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"radiusMiles":25'),
      }),
      expect.any(Object),
    );

    expect(browseSearchCacheKey({ q: 'bike', sort: 'distance', page: 2 })).toContain('browse-search');
    expect(useBffBrowse()).toBe(true);
  });
});
