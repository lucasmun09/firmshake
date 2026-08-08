import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loggedFetch = vi.fn();

vi.mock('@/common/debug/loggedFetch', () => ({
  loggedFetch,
}));

vi.mock('@/utils/apiBaseUrl', () => ({
  getApiBaseUrl: () => 'https://api.example.test',
  isApiConfigured: () => true,
}));

describe('checkApiHealth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    loggedFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true on the first successful health probe', async () => {
    loggedFetch.mockResolvedValueOnce({ ok: true });

    const { checkApiHealth } = await import('@/common/services/api');
    await expect(checkApiHealth()).resolves.toBe(true);
    expect(loggedFetch).toHaveBeenCalledTimes(1);
  });

  it('retries after failures and succeeds on a later attempt', async () => {
    loggedFetch
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });

    const { checkApiHealth } = await import('@/common/services/api');
    const resultPromise = checkApiHealth();

    await vi.advanceTimersByTimeAsync(2_000);
    await vi.advanceTimersByTimeAsync(4_000);
    await expect(resultPromise).resolves.toBe(true);
    expect(loggedFetch).toHaveBeenCalledTimes(3);
  });

  it('returns false after all retry attempts fail', async () => {
    loggedFetch.mockRejectedValue(new Error('network'));

    const { checkApiHealth } = await import('@/common/services/api');
    const resultPromise = checkApiHealth();

    await vi.advanceTimersByTimeAsync(2_000);
    await vi.advanceTimersByTimeAsync(4_000);
    await expect(resultPromise).resolves.toBe(false);
    expect(loggedFetch).toHaveBeenCalledTimes(3);
  });
});
