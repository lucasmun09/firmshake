import { describe, expect, it, vi } from 'vitest';

import {
  AUTHENTICATED_ROOT_PATH,
  GUEST_BROWSE_PATH,
  LANDING_PATH,
  NATIVE_ENTRY_PATH,
  resolveGuestRootPath,
  resolveRootDestination,
} from '@/router/rootRoute';

vi.mock('@/utils/platform', () => ({
  isNativePlatform: vi.fn(),
  isMobileWeb: vi.fn(),
}));

import { isMobileWeb, isNativePlatform } from '@/utils/platform';

describe('resolveGuestRootPath', () => {
  it('sends native apps to login', () => {
    vi.mocked(isNativePlatform).mockReturnValue(true);
    vi.mocked(isMobileWeb).mockReturnValue(false);
    expect(resolveGuestRootPath()).toBe(NATIVE_ENTRY_PATH);
  });

  it('sends mobile web guests to browse', () => {
    vi.mocked(isNativePlatform).mockReturnValue(false);
    vi.mocked(isMobileWeb).mockReturnValue(true);
    expect(resolveGuestRootPath()).toBe(GUEST_BROWSE_PATH);
  });

  it('sends desktop web guests to the landing page', () => {
    vi.mocked(isNativePlatform).mockReturnValue(false);
    vi.mocked(isMobileWeb).mockReturnValue(false);
    expect(resolveGuestRootPath()).toBe(LANDING_PATH);
  });
});

describe('resolveRootDestination', () => {
  it('sends signed-in users to browse', () => {
    expect(resolveRootDestination(true)).toBe(AUTHENTICATED_ROOT_PATH);
  });

  it('sends guests to the platform guest root', () => {
    vi.mocked(isNativePlatform).mockReturnValue(false);
    vi.mocked(isMobileWeb).mockReturnValue(false);
    expect(resolveRootDestination(false)).toBe(LANDING_PATH);
  });
});
