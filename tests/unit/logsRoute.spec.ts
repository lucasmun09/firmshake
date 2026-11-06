import { afterEach, describe, expect, it, vi } from 'vitest';

import { isLogsInitialPath, isLogsRoute, shouldSkipAuthReadyWait } from '@/router/logsRoute';

describe('isLogsInitialPath', () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    if (originalWindow) {
      vi.stubGlobal('window', originalWindow);
    }
  });

  it('detects /logs pathname and hash routes', () => {
    vi.stubGlobal('window', {
      location: { pathname: '/logs', hash: '' },
    });
    expect(isLogsInitialPath()).toBe(true);

    vi.stubGlobal('window', {
      location: { pathname: '/', hash: '#/logs' },
    });
    expect(isLogsInitialPath()).toBe(true);
  });

  it('does not match other app paths', () => {
    vi.stubGlobal('window', {
      location: { pathname: '/tabs/home', hash: '' },
    });
    expect(isLogsInitialPath()).toBe(false);
  });
});

describe('isLogsRoute', () => {
  it('matches the Logs route by name and path', () => {
    expect(isLogsRoute({ name: 'Logs', path: '/logs' })).toBe(true);
    expect(isLogsRoute({ path: '/logs' })).toBe(true);
  });

  it('does not match other skipAuthFlow routes or app routes', () => {
    expect(isLogsRoute({ name: 'Profile', path: '/tabs/profile' })).toBe(false);
    expect(isLogsRoute({ name: 'MfaEnroll', path: '/mfa-enroll' })).toBe(false);
    expect(isLogsRoute({ name: 'Home', path: '/tabs/home' })).toBe(false);
    expect(isLogsRoute({ path: '/logs-old' })).toBe(false);
  });
});

describe('shouldSkipAuthReadyWait', () => {
  it('skips authReady wait for /logs and public routes', () => {
    expect(shouldSkipAuthReadyWait({ name: 'Logs', path: '/logs' })).toBe(true);
    expect(shouldSkipAuthReadyWait({ name: 'Login', path: '/login', meta: { public: true } })).toBe(true);
    expect(shouldSkipAuthReadyWait({ name: 'MfaChallenge', path: '/mfa-challenge', meta: { public: true } })).toBe(true);
  });

  it('does not skip authReady wait for protected routes', () => {
    expect(shouldSkipAuthReadyWait({ name: 'Home', path: '/tabs/home' })).toBe(false);
    expect(shouldSkipAuthReadyWait({ name: 'Profile', path: '/tabs/profile', meta: { skipAuthFlow: true } })).toBe(false);
  });
});
