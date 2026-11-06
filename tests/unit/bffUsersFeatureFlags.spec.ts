import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/apiBaseUrl', () => ({
  isApiConfigured: vi.fn(() => true),
}));

describe('useBffUsers feature flag', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function loadFlags(env: Record<string, string | boolean | undefined> = {}) {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) {
        continue;
      }
      vi.stubEnv(key, String(value));
    }
    return import('@/common/config/featureFlags');
  }

  it('returns true when explicitly enabled and API is configured', async () => {
    const { useBffUsers } = await loadFlags({ VITE_USE_BFF_USERS: 'true' });
    expect(useBffUsers()).toBe(true);
  });

  it('returns false when explicitly disabled', async () => {
    vi.stubEnv('DEV', 'true');
    const { useBffUsers } = await loadFlags({ VITE_USE_BFF_USERS: 'false' });
    expect(useBffUsers()).toBe(false);
  });

  it('defaults to dev + API configured when unset', async () => {
    vi.stubEnv('DEV', 'true');
    const { useBffUsers } = await loadFlags({});
    expect(useBffUsers()).toBe(true);
  });

  it('defaults to false in production when unset', async () => {
    vi.stubEnv('DEV', '');
    const { useBffUsers } = await loadFlags({});
    expect(useBffUsers()).toBe(false);
  });
});
