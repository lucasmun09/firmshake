import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/apiBaseUrl', () => ({
  isApiConfigured: vi.fn(() => true),
}));

describe('featureFlags', () => {
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

  it('useBffListings returns true when explicitly enabled and API is configured', async () => {
    const { useBffListings } = await loadFlags({ VITE_USE_BFF_LISTINGS: 'true' });
    expect(useBffListings()).toBe(true);
  });

  it('useBffListings returns false when explicitly disabled', async () => {
    vi.stubEnv('DEV', 'true');
    const { useBffListings } = await loadFlags({ VITE_USE_BFF_LISTINGS: 'false' });
    expect(useBffListings()).toBe(false);
  });

  it('useBffListings defaults to dev + API configured when unset', async () => {
    vi.stubEnv('DEV', 'true');
    const { useBffListings } = await loadFlags({});
    expect(useBffListings()).toBe(true);
  });

  it('useBffListings defaults to false in production when unset', async () => {
    vi.stubEnv('DEV', '');
    const { useBffListings } = await loadFlags({});
    expect(useBffListings()).toBe(false);
  });

  it('useBffMessages defaults to false when unset', async () => {
    const { useBffMessages } = await loadFlags({});
    expect(useBffMessages()).toBe(false);
  });

  it('useBffMessages returns true only when explicitly enabled and API is configured', async () => {
    const { useBffMessages } = await loadFlags({ VITE_USE_BFF_MESSAGES: 'true' });
    expect(useBffMessages()).toBe(true);
  });

  it('useBffMessages returns false when explicitly disabled', async () => {
    const { useBffMessages } = await loadFlags({ VITE_USE_BFF_MESSAGES: 'false' });
    expect(useBffMessages()).toBe(false);
  });

  it('useBffAgreements defaults to dev + API configured when unset', async () => {
    vi.stubEnv('DEV', 'true');
    const { useBffAgreements } = await loadFlags({});
    expect(useBffAgreements()).toBe(true);
  });

  it('useBffAgreements defaults to false in production when unset', async () => {
    vi.stubEnv('DEV', '');
    const { useBffAgreements } = await loadFlags({});
    expect(useBffAgreements()).toBe(false);
  });

  it('useBffAgreements returns true when explicitly enabled', async () => {
    const { useBffAgreements } = await loadFlags({ VITE_USE_BFF_AGREEMENTS: 'true' });
    expect(useBffAgreements()).toBe(true);
  });

  it('useBffInbox defaults to false when unset', async () => {
    const { useBffInbox } = await loadFlags({});
    expect(useBffInbox()).toBe(false);
  });

  it('useBffInbox returns true only when explicitly enabled and API is configured', async () => {
    const { useBffInbox } = await loadFlags({ VITE_USE_BFF_INBOX: 'true' });
    expect(useBffInbox()).toBe(true);
  });

  it('useBffInbox returns false when explicitly disabled', async () => {
    const { useBffInbox } = await loadFlags({ VITE_USE_BFF_INBOX: 'false' });
    expect(useBffInbox()).toBe(false);
  });
});
