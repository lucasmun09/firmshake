import { describe, expect, it, vi, beforeEach } from 'vitest';

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
      categories: [{ id: 'general', name: 'General', slug: 'general' }],
    }),
  })),
}));

vi.mock('@/common/services/api', () => ({
  authHeaders: vi.fn(async () => ({})),
}));

vi.mock('@/common/services/responseCache', () => ({
  buildCacheKey: (...parts: unknown[]) => JSON.stringify(parts),
  getCached: vi.fn(() => null),
  getStaleCached: vi.fn(() => null),
  invalidateCached: vi.fn(),
  setCached: vi.fn(),
}));

describe('categoriesBff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches categories from GET /api/v1/categories', async () => {
    const { loggedFetch } = await import('@/common/debug/loggedFetch');
    const { fetchCategoriesViaBff } = await import('@/features/listings/services/categoriesBff');

    const categories = await fetchCategoriesViaBff({ activeOnly: true });

    expect(categories[0]?.id).toBe('general');
    expect(loggedFetch).toHaveBeenCalledWith(
      'https://api.test/api/v1/categories?active=true',
      expect.any(Object),
      expect.any(Object),
    );
  });
});
