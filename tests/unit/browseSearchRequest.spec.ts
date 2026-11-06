import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('browseSearchRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('buildBrowseSearchRequestBody includes geo and category filters', async () => {
    const { buildBrowseSearchRequestBody } = await import(
      '@/features/listings/services/browseSearchRequest'
    );

    expect(
      buildBrowseSearchRequestBody(
        {
          q: 'bike',
          categoryId: 'sports',
          priceMin: 10,
          lat: 38.75,
          lng: -77.47,
          radiusMiles: 12,
          sort: 'distance',
        },
        2,
        24,
      ),
    ).toEqual({
      communityId: 'all',
      page: 2,
      pageSize: 24,
      sort: 'distance',
      q: 'bike',
      categoryId: 'sports',
      priceMin: 10,
      lat: 38.75,
      lng: -77.47,
      radiusMiles: 12,
    });
  });

  it('fetchBrowseSearchEndpoint posts to /summary and returns payload', async () => {
    const { loggedFetch } = await import('@/common/debug/loggedFetch');
    vi.mocked(loggedFetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        listings: [{ id: 'l1', title: 'Bike', price: 100, imageUrl: 'https://cdn/a.jpg' }],
        total: 1,
        page: 1,
        pageSize: 24,
        hasMore: false,
        shape: 'summary',
      }),
    } as Response);

    const { fetchBrowseSearchEndpoint } = await import(
      '@/features/listings/services/browseSearchRequest'
    );

    const result = await fetchBrowseSearchEndpoint('summary', { q: 'bike' }, 1, 24);

    expect(loggedFetch).toHaveBeenCalledWith(
      'https://api.test/api/v1/browse/summary',
      expect.objectContaining({ method: 'POST' }),
      expect.any(Object),
    );
    expect(result).toEqual({
      ok: true,
      payload: expect.objectContaining({ shape: 'summary', total: 1 }),
    });
  });

  it('fetchBrowseSearchEndpoint returns status on non-OK responses', async () => {
    const { loggedFetch } = await import('@/common/debug/loggedFetch');
    vi.mocked(loggedFetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'missing' }),
    } as Response);

    const { fetchBrowseSearchEndpoint } = await import(
      '@/features/listings/services/browseSearchRequest'
    );

    await expect(fetchBrowseSearchEndpoint('summary', {}, 1, 24)).resolves.toEqual({
      ok: false,
      status: 404,
    });
  });

  it('attaches Authorization Bearer so the API can apply block-list filtering', async () => {
    const { authHeaders } = await import('@/common/services/api');
    vi.mocked(authHeaders).mockResolvedValue({ Authorization: 'Bearer tok-123' });

    const { loggedFetch } = await import('@/common/debug/loggedFetch');
    vi.mocked(loggedFetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        listings: [],
        total: 0,
        page: 1,
        pageSize: 24,
        hasMore: false,
      }),
    } as Response);

    const { fetchBrowseSearchEndpoint } = await import(
      '@/features/listings/services/browseSearchRequest'
    );
    await fetchBrowseSearchEndpoint('search', { communityId: 'all' }, 1, 24);

    expect(loggedFetch).toHaveBeenCalledWith(
      'https://api.test/api/v1/browse/search',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok-123' }),
      }),
      expect.any(Object),
    );
  });
});
