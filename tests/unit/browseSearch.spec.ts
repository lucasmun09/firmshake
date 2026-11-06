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
  loggedFetch: vi.fn(),
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

  it('prefers POST /api/v1/browse/summary for combined filters', async () => {
    const { loggedFetch } = await import('@/common/debug/loggedFetch');
    vi.mocked(loggedFetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        listings: [
          {
            id: 'l1',
            title: 'Bike',
            price: 100,
            imageUrl: 'https://cdn/a.jpg',
            communityIds: ['all'],
            primaryCategoryId: 'general',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 24,
        hasMore: false,
        engine: 'firestore',
        shape: 'summary',
      }),
    } as Response);

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
      'https://api.test/api/v1/browse/summary',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"radiusMiles":25'),
      }),
      expect.any(Object),
    );
    expect(loggedFetch).toHaveBeenCalledTimes(1);

    expect(browseSearchCacheKey({ q: 'bike', sort: 'distance', page: 2 })).toContain('browse-search');
    expect(useBffBrowse()).toBe(true);
  });

  it('falls back to /search when /summary is unavailable', async () => {
    const { loggedFetch } = await import('@/common/debug/loggedFetch');
    vi.mocked(loggedFetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'not found' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          listings: [
            {
              id: 'l2',
              title: 'Chair',
              description: 'Oak',
              price: 40,
              imageUrl: 'https://cdn/chair.jpg',
              imageUrls: ['https://cdn/chair.jpg'],
              communityIds: ['all'],
              primaryCategoryId: 'furniture',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 24,
          hasMore: false,
          engine: 'firestore',
        }),
      } as Response);

    const { searchBrowseListings } = await import('@/features/listings/services/browseSearch');
    const result = await searchBrowseListings({ q: 'chair' });

    expect(loggedFetch).toHaveBeenNthCalledWith(
      1,
      'https://api.test/api/v1/browse/summary',
      expect.any(Object),
      expect.any(Object),
    );
    expect(loggedFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.test/api/v1/browse/search',
      expect.any(Object),
      expect.any(Object),
    );
    expect(result.listings[0]?.id).toBe('l2');
    expect(result.listings[0]?.description).toBe('Oak');
  });
});
