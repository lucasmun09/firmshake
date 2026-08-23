import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('appStack', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function loadStack(env: Record<string, string | boolean | undefined> = {}) {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) {
        continue;
      }
      vi.stubEnv(key, String(value));
    }
    return import('@/common/config/appStack');
  }

  it('resolves firmshake-dev project id as deovo', async () => {
    const { resolveAppStack, isDevoStack, isDevoDebugUiEnabled, shouldPersistDebugLogs } =
      await loadStack({
        VITE_FIREBASE_PROJECT_ID: 'firmshake-dev',
        DEV: '',
      });

    expect(resolveAppStack()).toBe('devo');
    expect(isDevoStack()).toBe(true);
    expect(isDevoDebugUiEnabled()).toBe(true);
    expect(shouldPersistDebugLogs()).toBe(true);
  });

  it('resolves firmshake-prod project id as prod', async () => {
    const { resolveAppStack, isDevoStack, isDevoDebugUiEnabled, shouldPersistDebugLogs } =
      await loadStack({
        VITE_FIREBASE_PROJECT_ID: 'firmshake-prod',
        DEV: '',
      });

    expect(resolveAppStack()).toBe('prod');
    expect(isDevoStack()).toBe(false);
    expect(isDevoDebugUiEnabled()).toBe(false);
    expect(shouldPersistDebugLogs()).toBe(false);
  });

  it('honors explicit VITE_APP_STACK over project id', async () => {
    const { resolveAppStack } = await loadStack({
      VITE_APP_STACK: 'devo',
      VITE_FIREBASE_PROJECT_ID: 'firmshake-prod',
      DEV: '',
    });
    expect(resolveAppStack()).toBe('devo');
  });

  it('treats Vite DEV as deovo when project id is unset', async () => {
    vi.stubEnv('DEV', 'true');
    const { resolveAppStack, isDevoDebugUiEnabled } = await loadStack({
      VITE_FIREBASE_PROJECT_ID: '',
    });
    expect(resolveAppStack()).toBe('devo');
    expect(isDevoDebugUiEnabled()).toBe(true);
  });

  it('returns unknown for production builds without a known project id', async () => {
    const { resolveAppStack, isDevoDebugUiEnabled } = await loadStack({
      VITE_FIREBASE_PROJECT_ID: 'some-other-project',
      DEV: '',
    });
    expect(resolveAppStack({ isDev: false, projectId: 'some-other-project' })).toBe('unknown');
    expect(isDevoDebugUiEnabled({ isDev: false, projectId: 'some-other-project' })).toBe(false);
  });
});
