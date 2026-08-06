import { describe, expect, it } from 'vitest';

import {
  getTabBootTitle,
  isDirectTabFeedPath,
  isTabsShellSwitch,
  isWithinTabsShell,
  shouldDeferPostAuthChecks,
} from '@/router/tabsRoute';

describe('isWithinTabsShell', () => {
  it('matches tab routes', () => {
    expect(isWithinTabsShell('/tabs')).toBe(true);
    expect(isWithinTabsShell('/tabs/')).toBe(true);
    expect(isWithinTabsShell('/tabs/home')).toBe(true);
    expect(isWithinTabsShell('/tabs/buying/listing/abc')).toBe(true);
  });

  it('does not match routes outside tabs', () => {
    expect(isWithinTabsShell('/login')).toBe(false);
    expect(isWithinTabsShell('/listing/abc')).toBe(false);
    expect(isWithinTabsShell('/')).toBe(false);
  });
});

describe('isTabsShellSwitch', () => {
  it('detects tab-to-tab navigation', () => {
    expect(isTabsShellSwitch({ path: '/tabs/home' }, { path: '/tabs/buying' })).toBe(true);
    expect(isTabsShellSwitch({ path: '/tabs/inbox/listing/x' }, { path: '/tabs/selling' })).toBe(true);
  });

  it('does not match entry from outside tabs', () => {
    expect(isTabsShellSwitch({ path: '/login' }, { path: '/tabs/home' })).toBe(false);
    expect(isTabsShellSwitch({ path: '/listing/x' }, { path: '/tabs/home' })).toBe(false);
  });

  it('does not match leaving tabs shell', () => {
    expect(isTabsShellSwitch({ path: '/tabs/home' }, { path: '/listing/x' })).toBe(false);
  });
});

describe('isDirectTabFeedPath', () => {
  it('matches buying, selling, and inbox roots', () => {
    expect(isDirectTabFeedPath('/tabs/buying')).toBe(true);
    expect(isDirectTabFeedPath('/tabs/selling/')).toBe(true);
    expect(isDirectTabFeedPath('/tabs/inbox')).toBe(true);
  });

  it('does not match nested or other tab routes', () => {
    expect(isDirectTabFeedPath('/tabs/home')).toBe(false);
    expect(isDirectTabFeedPath('/tabs/buying/listing/x')).toBe(false);
    expect(isDirectTabFeedPath('/login')).toBe(false);
  });
});

describe('shouldDeferPostAuthChecks', () => {
  it('defers for tab-to-tab navigation', () => {
    expect(shouldDeferPostAuthChecks({ path: '/tabs/home' }, { path: '/tabs/buying' })).toBe(true);
  });

  it('defers for direct entry into tabs shell', () => {
    expect(shouldDeferPostAuthChecks({ path: '/' }, { path: '/tabs/buying' })).toBe(true);
    expect(shouldDeferPostAuthChecks({ path: '/login' }, { path: '/tabs/inbox' })).toBe(true);
  });

  it('does not defer for routes outside tabs shell', () => {
    expect(shouldDeferPostAuthChecks({ path: '/tabs/home' }, { path: '/listing/x' })).toBe(false);
  });
});

describe('getTabBootTitle', () => {
  it('returns titles for tab routes', () => {
    expect(getTabBootTitle('/tabs/buying')).toBe('Buying');
    expect(getTabBootTitle('/tabs/selling/')).toBe('Selling');
  });
});
