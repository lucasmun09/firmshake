import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('paymentsFlag', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function load() {
    return import('@/common/config/paymentsFlag');
  }

  it('defaults to enabled when unset', async () => {
    const { isPaymentsEnabled } = await load();
    expect(isPaymentsEnabled({ paymentsEnabled: undefined, stripePaymentsEnabled: undefined })).toBe(
      true,
    );
  });

  it('disables when VITE_PAYMENTS_ENABLED=false', async () => {
    const { isPaymentsEnabled } = await load();
    expect(isPaymentsEnabled({ paymentsEnabled: 'false' })).toBe(false);
  });

  it('prefers stripe alias over payments flag', async () => {
    const { isPaymentsEnabled } = await load();
    expect(
      isPaymentsEnabled({ paymentsEnabled: 'true', stripePaymentsEnabled: 'false' }),
    ).toBe(false);
  });

  it('exposes stable disabled copy for UI toasts', async () => {
    const { PAYMENTS_DISABLED_USER_MESSAGE } = await load();
    expect(PAYMENTS_DISABLED_USER_MESSAGE.toLowerCase()).toContain('unavailable');
    expect(PAYMENTS_DISABLED_USER_MESSAGE.toLowerCase()).not.toMatch(/soon|stripe|coming/);
  });
});

