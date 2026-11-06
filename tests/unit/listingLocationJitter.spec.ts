import { describe, expect, it } from 'vitest';

import {
  LISTING_MAP_JITTER_MAX_MILES,
  hashStringToSeed,
  jitterListingMapCenter,
  jitterOffsetMiles,
} from '@/features/listings/utils/listingLocationJitter';

describe('listingLocationJitter', () => {
  const lat = 42.3314;
  const lng = -83.0458;

  it('is deterministic for the same listing id', () => {
    const first = jitterListingMapCenter('listing-abc', lat, lng);
    const second = jitterListingMapCenter('listing-abc', lat, lng);

    expect(first).toEqual(second);
  });

  it('varies by listing id', () => {
    const first = jitterListingMapCenter('listing-abc', lat, lng);
    const second = jitterListingMapCenter('listing-xyz', lat, lng);

    expect(first).not.toEqual(second);
  });

  it('offsets the center by at most half a mile', () => {
    const ids = ['a', 'listing-1', 'listing-2', 'long-listing-id-12345'];

    for (const id of ids) {
      const offset = jitterOffsetMiles(id, lat, lng);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThanOrEqual(LISTING_MAP_JITTER_MAX_MILES + 1e-9);
    }
  });

  it('hashes strings to stable seeds', () => {
    expect(hashStringToSeed('listing-abc')).toBe(hashStringToSeed('listing-abc'));
    expect(hashStringToSeed('listing-abc')).not.toBe(hashStringToSeed('listing-xyz'));
  });
});
