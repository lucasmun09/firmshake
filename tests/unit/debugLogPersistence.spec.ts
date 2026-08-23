import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const shouldPersistDebugLogs = vi.fn(() => true);

vi.mock('@/common/config/appStack', () => ({
  shouldPersistDebugLogs: (...args: unknown[]) => shouldPersistDebugLogs(...args),
}));

describe('debugLog deovo persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    shouldPersistDebugLogs.mockReturnValue(true);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('auto-persists entries to localStorage on deovo', async () => {
    const { debugLog, getDebugLogs } = await import('@/common/debug/debugLog');
    debugLog.info('devo-debug', 'persist.check', { ok: true });

    expect(getDebugLogs().some((entry) => entry.message === 'persist.check')).toBe(true);
    const raw = localStorage.getItem('firmshake.debugLogs');
    expect(raw).toBeTruthy();
    expect(raw).toContain('persist.check');
  });

  it('keeps memory logs but skips localStorage writes on prod', async () => {
    shouldPersistDebugLogs.mockReturnValue(false);
    const { debugLog, getDebugLogs, clearDebugLogs } = await import('@/common/debug/debugLog');

    debugLog.info('devo-debug', 'memory.only', { ok: true });
    expect(getDebugLogs().some((entry) => entry.message === 'memory.only')).toBe(true);
    expect(localStorage.getItem('firmshake.debugLogs')).toBeNull();

    clearDebugLogs();
    expect(getDebugLogs()).toEqual([]);
  });
});
