import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearThreadEnrichCache,
  getThreadEnrichListing,
  getThreadEnrichListings,
  setThreadEnrichListing,
  setThreadEnrichListings,
  THREAD_ENRICH_CACHE_MAX,
  THREAD_ENRICH_CACHE_TTL_MS,
  threadEnrichCacheSize,
} from '@/features/messages/services/threadEnrichCache';

function listing(id: string, title = `Listing ${id}`) {
  return {
    id,
    title,
    imageUrl: `/img/${id}.jpg`,
    sellerId: 'seller-1',
    sellerName: 'Sam',
    status: 'active' as const,
  };
}

describe('threadEnrichCache', () => {
  afterEach(() => {
    clearThreadEnrichCache();
    vi.useRealTimers();
  });

  it('stores and returns enrich fields', () => {
    setThreadEnrichListing(listing('a', 'Bike'));
    expect(getThreadEnrichListing('a')).toEqual(
      expect.objectContaining({ id: 'a', title: 'Bike', sellerId: 'seller-1' }),
    );
  });

  it('returns only fresh hits for a batch lookup', () => {
    setThreadEnrichListings([listing('a'), listing('b')]);
    const found = getThreadEnrichListings(['a', 'missing', 'b']);
    expect([...found.keys()].sort()).toEqual(['a', 'b']);
  });

  it('expires entries after TTL', () => {
    vi.useFakeTimers();
    setThreadEnrichListing(listing('a'));
    vi.advanceTimersByTime(THREAD_ENRICH_CACHE_TTL_MS + 1);
    expect(getThreadEnrichListing('a')).toBeNull();
    expect(threadEnrichCacheSize()).toBe(0);
  });

  it('evicts oldest entries when over max size', () => {
    for (let i = 0; i < THREAD_ENRICH_CACHE_MAX + 5; i += 1) {
      setThreadEnrichListing(listing(`id-${i}`));
    }
    expect(threadEnrichCacheSize()).toBe(THREAD_ENRICH_CACHE_MAX);
    expect(getThreadEnrichListing('id-0')).toBeNull();
    expect(getThreadEnrichListing(`id-${THREAD_ENRICH_CACHE_MAX + 4}`)).not.toBeNull();
  });
});
