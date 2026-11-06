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

    const { checkApiHealth } = await import('@/common/services/apiHealth');
    await expect(checkApiHealth()).resolves.toBe(true);
    expect(loggedFetch).toHaveBeenCalledTimes(1);
  });

  it('retries after failures and succeeds on a later attempt', async () => {
    loggedFetch
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });

    const { checkApiHealth } = await import('@/common/services/apiHealth');
    const resultPromise = checkApiHealth();

    await vi.advanceTimersByTimeAsync(2_000);
    await vi.advanceTimersByTimeAsync(4_000);
    await expect(resultPromise).resolves.toBe(true);
    expect(loggedFetch).toHaveBeenCalledTimes(3);
  });

  it('returns false after all retry attempts fail', async () => {
    loggedFetch.mockRejectedValue(new Error('network'));

    const { checkApiHealth } = await import('@/common/services/apiHealth');
    const resultPromise = checkApiHealth();

    await vi.advanceTimersByTimeAsync(2_000);
    await vi.advanceTimersByTimeAsync(4_000);
    await expect(resultPromise).resolves.toBe(false);
    expect(loggedFetch).toHaveBeenCalledTimes(3);
  });

  it('parses dual-stack health payload JSON', async () => {
    loggedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'ok',
        service: 'firmshake-api',
        stack: 'devo',
        firebaseProjectId: 'firmshake-dev',
        paymentsEnabled: true,
      }),
    });

    const { fetchApiHealthPayload } = await import('@/common/services/apiHealth');
    await expect(fetchApiHealthPayload()).resolves.toEqual({
      status: 'ok',
      service: 'firmshake-api',
      stack: 'devo',
      firebaseProjectId: 'firmshake-dev',
      paymentsEnabled: true,
    });
  });

  it('parses /ready payload with ready=true', async () => {
    loggedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'ok',
        service: 'firmshake-api',
        stack: 'prod',
        firebaseProjectId: 'firmshake-prod',
        paymentsEnabled: false,
        ready: true,
      }),
    });

    const { fetchApiReadyPayload } = await import('@/common/services/apiHealth');
    await expect(fetchApiReadyPayload()).resolves.toMatchObject({
      stack: 'prod',
      ready: true,
      paymentsEnabled: false,
    });
  });
});
