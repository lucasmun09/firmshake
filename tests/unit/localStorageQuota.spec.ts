import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import {
  estimateLocalStorageUsage,
  estimatePrefixUsage,
  evictBrowseLocalCacheEntries,
  freeLocalStorageForAuth,
  isProtectedLocalStorageKey,
  isQuotaExceededError,
  safeLocalStorageSetItem,
} from '@/common/services/localStorageQuota';

describe('localStorageQuota', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('detects QuotaExceededError by name and message', () => {
    expect(isQuotaExceededError(new DOMException('quota', 'QuotaExceededError'))).toBe(true);
    expect(
      isQuotaExceededError(
        new Error("Failed to execute 'setItem' on 'Storage': Setting the value exceeded the quota."),
      ),
    ).toBe(true);
    expect(isQuotaExceededError({ name: 'QuotaExceededError' })).toBe(true);
    expect(isQuotaExceededError(new Error('network failed'))).toBe(false);
  });

  it('never treats firebase auth keys as evictable', () => {
    expect(isProtectedLocalStorageKey('firebase:authUser:abc:[DEFAULT]')).toBe(true);
    expect(isProtectedLocalStorageKey('firmshake-browse-local:all')).toBe(false);
  });

  it('evicts oldest browse cache entries first', () => {
    localStorage.setItem(
      'firmshake-browse-local:old',
      JSON.stringify({ data: { cachedAt: 100 }, expiresAt: Date.now() + 1000 }),
    );
    localStorage.setItem(
      'firmshake-browse-local:new',
      JSON.stringify({ data: { cachedAt: 900 }, expiresAt: Date.now() + 1000 }),
    );

    const freed = evictBrowseLocalCacheEntries({ maxEntries: 1 });

    expect(freed).toBeGreaterThan(0);
    expect(localStorage.getItem('firmshake-browse-local:old')).toBeNull();
    expect(localStorage.getItem('firmshake-browse-local:new')).not.toBeNull();
  });

  it('freeLocalStorageForAuth preserves firebase keys', () => {
    localStorage.setItem('firebase:authUser:test:[DEFAULT]', '{"uid":"abc"}');
    localStorage.setItem(
      'firmshake-browse-local:bucket',
      JSON.stringify({ data: { cachedAt: 1 }, expiresAt: Date.now() + 1000 }),
    );

    freeLocalStorageForAuth();

    expect(localStorage.getItem('firebase:authUser:test:[DEFAULT]')).not.toBeNull();
    expect(localStorage.getItem('firmshake-browse-local:bucket')).toBeNull();
  });

  it('safeLocalStorageSetItem evicts browse cache and retries on quota failure', () => {
    localStorage.setItem(
      'firmshake-browse-local:stale',
      JSON.stringify({ data: { cachedAt: 1 }, expiresAt: Date.now() + 1000 }),
    );

    const originalSetItem = Storage.prototype.setItem;
    let attempts = 0;

    Storage.prototype.setItem = function setItem(key: string, value: string) {
      attempts += 1;
      if (attempts === 1 && key === 'firmshake-browse-local:fresh') {
        throw new DOMException('quota', 'QuotaExceededError');
      }
      return originalSetItem.call(this, key, value);
    };

    const ok = safeLocalStorageSetItem(
      'firmshake-browse-local:fresh',
      JSON.stringify({ data: { cachedAt: 2 }, expiresAt: Date.now() + 1000 }),
    );

    Storage.prototype.setItem = originalSetItem;

    expect(ok).toBe(true);
    expect(localStorage.getItem('firmshake-browse-local:fresh')).not.toBeNull();
  });

  it('estimates prefix usage in characters', () => {
    localStorage.setItem('firmshake-browse-local:a', '12345');
    localStorage.setItem('firmshake-browse-local:b', '678');
    localStorage.setItem('other-key', 'x');

    expect(estimatePrefixUsage('firmshake-browse-local:')).toBeGreaterThan(0);
    expect(estimateLocalStorageUsage()).toBeGreaterThanOrEqual(
      estimatePrefixUsage('firmshake-browse-local:'),
    );
  });
});
