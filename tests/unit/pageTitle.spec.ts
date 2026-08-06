import { describe, expect, it } from 'vitest';

import {
  formatDocumentTitle,
  resolveRouteTitle,
} from '@/router/pageTitle';

describe('formatDocumentTitle', () => {
  it('prefixes page titles with firm-shake', () => {
    expect(formatDocumentTitle('Browse')).toBe('firm-shake - Browse');
    expect(formatDocumentTitle('Login')).toBe('firm-shake - Login');
  });
});

describe('resolveRouteTitle', () => {
  it('maps route names to display titles', () => {
    expect(resolveRouteTitle({ name: 'Home', path: '/tabs/home', meta: {} } as never)).toBe('Browse');
    expect(resolveRouteTitle({ name: 'Login', path: '/login', meta: {} } as never)).toBe('Login');
    expect(resolveRouteTitle({ name: 'Buying', path: '/tabs/buying', meta: {} } as never)).toBe('Buying');
    expect(resolveRouteTitle({ name: 'ListingDetail', path: '/listing/abc', meta: {} } as never)).toBe('Listing');
    expect(resolveRouteTitle({ name: 'BlockedUsers', path: '/blockedusers', meta: {} } as never)).toBe('Blocked Users');
    expect(resolveRouteTitle({ name: 'Profile', path: '/tabs/profile', meta: {} } as never)).toBe('Settings');
  });

  it('prefers meta.title when provided', () => {
    expect(resolveRouteTitle({
      name: 'Home',
      path: '/tabs/home',
      meta: { title: 'Custom' },
    } as never)).toBe('Custom');
  });
});
