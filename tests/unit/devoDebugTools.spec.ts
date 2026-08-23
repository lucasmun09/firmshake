import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/common/config/appStack', () => ({
  isDevoDebugUiEnabled: vi.fn(() => true),
}));

vi.mock('@/common/services/appBootstrap', () => ({
  bootstrapProfile: { value: null },
}));

vi.mock('@/common/services/users', () => ({
  finalizePasswordAccountSetup: vi.fn(async () => undefined),
}));

vi.mock('@/features/auth/services/auth', () => ({
  currentUser: { value: null },
}));

vi.mock('@/common/debug/debugLog', () => ({
  debugLog: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('devoSmsBypass', () => {
  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    sessionStorage.clear();
    const { isDevoDebugUiEnabled } = await import('@/common/config/appStack');
    vi.mocked(isDevoDebugUiEnabled).mockReturnValue(true);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('enables and reads the bypass flag on deovo', async () => {
    const { isDevoSmsBypassEnabled, setDevoSmsBypassEnabled, DEVO_SMS_BYPASS_KEY } = await import(
      '@/common/debug/devoSmsBypass'
    );

    expect(isDevoSmsBypassEnabled()).toBe(false);
    setDevoSmsBypassEnabled(true);
    expect(isDevoSmsBypassEnabled()).toBe(true);
    expect(localStorage.getItem(DEVO_SMS_BYPASS_KEY)).toBe('1');
    expect(sessionStorage.getItem(DEVO_SMS_BYPASS_KEY)).toBe('1');
  });

  it('never reports bypass enabled when deovo debug UI is off', async () => {
    const { isDevoDebugUiEnabled } = await import('@/common/config/appStack');
    vi.mocked(isDevoDebugUiEnabled).mockReturnValue(false);

    const { isDevoSmsBypassEnabled, setDevoSmsBypassEnabled } = await import(
      '@/common/debug/devoSmsBypass'
    );

    expect(() => setDevoSmsBypassEnabled(true)).toThrow(/deovo stack/i);
    expect(isDevoSmsBypassEnabled()).toBe(false);
  });
});

describe('devoDebugTools mock wallet', () => {
  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    const { isDevoDebugUiEnabled } = await import('@/common/config/appStack');
    vi.mocked(isDevoDebugUiEnabled).mockReturnValue(true);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('loads a client-side mock balance on deovo', async () => {
    const {
      loadDevoMockAccountBalance,
      readDevoMockWallet,
      formatDevoBalanceDollars,
      DEVO_DEFAULT_BALANCE_CENTS,
    } = await import('@/common/debug/devoDebugTools');

    const wallet = loadDevoMockAccountBalance();
    expect(wallet.availableCents).toBe(DEVO_DEFAULT_BALANCE_CENTS);
    expect(formatDevoBalanceDollars(wallet.availableCents)).toBe('$100.00');
    expect(readDevoMockWallet()?.availableCents).toBe(DEVO_DEFAULT_BALANCE_CENTS);
  });

  it('refuses mock balance outside deovo', async () => {
    const { isDevoDebugUiEnabled } = await import('@/common/config/appStack');
    vi.mocked(isDevoDebugUiEnabled).mockReturnValue(false);

    const { loadDevoMockAccountBalance, readDevoMockWallet } = await import(
      '@/common/debug/devoDebugTools'
    );

    expect(() => loadDevoMockAccountBalance()).toThrow(/deovo stack/i);
    expect(readDevoMockWallet()).toBeNull();
  });
});
