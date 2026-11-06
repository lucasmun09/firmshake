import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyBrowseBlockListFilter } from '@/features/listings/utils/browseBlockFilter';
import { makeFullListing } from './marketplaceFixtures';

vi.mock('@/utils/apiBaseUrl', () => ({
  getApiBaseUrl: () => 'https://api.test',
  isApiConfigured: () => true,
}));

vi.mock('@/common/debug/loggedFetch', () => ({
  loggedFetch: vi.fn(),
}));

const authHeaders = vi.fn(async () => ({} as Record<string, string>));

vi.mock('@/common/services/api', () => ({
  authHeaders: (...args: unknown[]) => authHeaders(...args),
}));

describe('integration — browse block-list (Bearer + client filter)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authHeaders.mockResolvedValue({});
  });

  it('forwards Authorization Bearer on browse/summary so API can filter blocked sellers', async () => {
    authHeaders.mockResolvedValue({ Authorization: 'Bearer viewer-token' });
    const { loggedFetch } = await import('@/common/debug/loggedFetch');
    vi.mocked(loggedFetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        listings: [{ id: 'ok', title: 'Ok', price: 1, imageUrl: '', sellerId: 'seller-ok' }],
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
    await fetchBrowseSearchEndpoint('summary', { q: 'bike' }, 1, 24);

    expect(loggedFetch).toHaveBeenCalledWith(
      'https://api.test/api/v1/browse/summary',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer viewer-token',
          'Content-Type': 'application/json',
        }),
      }),
      expect.any(Object),
    );
  });

  it('omits Authorization when the viewer is a guest (no Bearer → no block filtering)', async () => {
    authHeaders.mockResolvedValue({});
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
    await fetchBrowseSearchEndpoint('search', {}, 1, 24);

    const [, init] = vi.mocked(loggedFetch).mock.calls[0] ?? [];
    const headers = (init as { headers?: Record<string, string> } | undefined)?.headers ?? {};
    expect(headers.Authorization).toBeUndefined();
  });

  it('client filter drops blocked-seller rows from a cached browse page', () => {
    const ok = makeFullListing({ id: 'ok', sellerId: 'seller-ok' });
    const blocked = makeFullListing({ id: 'blocked', sellerId: 'seller-blocked', title: 'Nope' });

    const filtered = applyBrowseBlockListFilter(
      { listings: [ok, blocked] },
      ['seller-blocked'],
    );

    expect(filtered.listings).toHaveLength(1);
    expect(filtered.listings[0]?.id).toBe('ok');
  });
});
