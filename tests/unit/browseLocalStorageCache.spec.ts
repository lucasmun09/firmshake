import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import {
  BROWSE_LOCAL_CACHE_MAX_ITEMS,
  BROWSE_LOCAL_CACHE_VERSION,
  buildBrowseLocalCachePayload,
  buildBrowseLocalAllKey,
  buildBrowseLocalMapKey,
  buildBrowseLocalSearchKey,
  clearBrowseLocalCacheIfUserChanged,
  getBrowseLocalCache,
  getStaleBrowseLocalCache,
  listingsFromCachePayload,
  mergeFreshBrowseResultsOnTop,
  persistBrowseLocalPool,
  removeListingFromAllBrowseLocalCaches,
  resolveBrowseLocalCacheKey,
} from '@/features/listings/services/browseLocalStorageCache';
import { viewportFromCenterRadius } from '@/features/listings/utils/browseMapView';
import type { Listing } from '@/types';

function makeListing(id: string): Listing {
  return {
    id,
    title: `Listing ${id}`,
    titleLower: `listing ${id}`,
    description: '',
    price: 10,
    imageUrl: '',
    imageUrls: [],
    sellerId: 'seller',
    sellerName: 'Seller',
    communityIds: ['all'],
    primaryCategoryId: 'general',
    categoryIds: [],
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('browseLocalStorageCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('builds distinct keys for all vs search vs map caches', () => {
    const uid = 'user-1';
    const base = {
      communityId: 'all',
      categoryId: '',
      priceMin: null,
      priceMax: null,
      lat: null,
      lng: null,
      radiusMiles: 10,
      sort: 'newest' as const,
    };

    const allKey = buildBrowseLocalAllKey(uid, base);
    const searchKey = buildBrowseLocalSearchKey(uid, { ...base, q: 'bike' });
    const mapKey = buildBrowseLocalMapKey(uid, viewportFromCenterRadius(38.9, -77.0, 5));

    expect(allKey).toContain('browse-local-all');
    expect(searchKey).toContain('browse-local-search');
    expect(mapKey).toContain('browse-local-map');
    expect(new Set([allKey, searchKey, mapKey]).size).toBe(3);
  });

  it('resolves search key when query is present', () => {
    const uid = 'user-1';
    const key = resolveBrowseLocalCacheKey(uid, {
      communityId: 'all',
      q: 'desk',
    });

    expect(key).toContain('browse-local-search');
    expect(key).toContain('q=desk');
  });

  it('persists and hydrates listing pools with ordered ids', () => {
    const uid = 'user-1';
    const key = buildBrowseLocalAllKey(uid, { communityId: 'all' });
    const listings = [makeListing('a'), makeListing('b')];

    persistBrowseLocalPool(key, listings, { hasMore: true, searchPage: 1 });

    const stale = getStaleBrowseLocalCache(key);
    expect(stale?.orderedIds).toEqual(['a', 'b']);
    expect(listingsFromCachePayload(stale!)).toHaveLength(2);

    const fresh = getBrowseLocalCache(key);
    expect(fresh?.orderedIds).toEqual(['a', 'b']);
  });

  it('caps stored listings at 300 items', () => {
    const listings = Array.from({ length: 350 }, (_, index) => makeListing(`id-${index}`));
    const payload = buildBrowseLocalCachePayload(listings, { hasMore: true });

    expect(payload.orderedIds).toHaveLength(BROWSE_LOCAL_CACHE_MAX_ITEMS);
    expect(Object.keys(payload.listingsById)).toHaveLength(BROWSE_LOCAL_CACHE_MAX_ITEMS);
    expect(payload.version).toBe(BROWSE_LOCAL_CACHE_VERSION);
  });

  it('merges fresh results on top while keeping stale tail', () => {
    const cached = [makeListing('1'), makeListing('2'), makeListing('3')];
    const fresh = [makeListing('9'), makeListing('2')];

    const merged = mergeFreshBrowseResultsOnTop(fresh, cached);

    expect(merged.map((listing) => listing.id)).toEqual(['9', '2', '1', '3']);
  });

  it('clears browse-local namespaces when uid changes', () => {
    const uid = 'user-1';
    const key = buildBrowseLocalAllKey(uid, { communityId: 'all' });
    persistBrowseLocalPool(key, [makeListing('a')], { hasMore: false });

    clearBrowseLocalCacheIfUserChanged('user-1');
    expect(getStaleBrowseLocalCache(key)).not.toBeNull();

    clearBrowseLocalCacheIfUserChanged('user-2');
    expect(getStaleBrowseLocalCache(key)).toBeNull();
  });

  it('includes zoom in map cache keys', () => {
    const uid = 'user-1';
    const baseViewport = viewportFromCenterRadius(38.9, -77.0, 5, 10);
    const zoomedViewport = viewportFromCenterRadius(38.9, -77.0, 5, 14);

    const keyAt10 = buildBrowseLocalMapKey(uid, baseViewport);
    const keyAt14 = buildBrowseLocalMapKey(uid, zoomedViewport);

    expect(keyAt10).toContain('zoom=10');
    expect(keyAt14).toContain('zoom=14');
    expect(keyAt10).not.toBe(keyAt14);
  });

  it('removes unavailable listings from all browse-local cache buckets', () => {
    const uid = 'user-1';
    const allKey = buildBrowseLocalAllKey(uid, { communityId: 'all' });
    const searchKey = buildBrowseLocalSearchKey(uid, { communityId: 'all', q: 'bike' });
    const mapKey = buildBrowseLocalMapKey(uid, viewportFromCenterRadius(38.9, -77.0, 5, 11));
    const keep = makeListing('keep');
    const remove = makeListing('remove');

    persistBrowseLocalPool(allKey, [keep, remove], { hasMore: false });
    persistBrowseLocalPool(searchKey, [remove, keep], { hasMore: false });
    persistBrowseLocalPool(mapKey, [keep, remove], { hasMore: false, viewport: viewportFromCenterRadius(38.9, -77.0, 5, 11) });

    const updated = removeListingFromAllBrowseLocalCaches('remove');

    expect(updated).toBe(3);
    expect(getStaleBrowseLocalCache(allKey)?.orderedIds).toEqual(['keep']);
    expect(getStaleBrowseLocalCache(searchKey)?.orderedIds).toEqual(['keep']);
    expect(getStaleBrowseLocalCache(mapKey)?.orderedIds).toEqual(['keep']);
    expect(getStaleBrowseLocalCache(allKey)?.listingsById.remove).toBeUndefined();
  });
});
