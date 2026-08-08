import { describe, expect, it } from 'vitest';

import { listingSearchCacheKey } from '@/features/listings/services/listingSearch';
import {
  clampRadiusMiles,
  MAX_RADIUS_MILES,
  milesToKm,
  MIN_RADIUS_MILES,
  normalizeRadiusMiles,
  RADIUS_OPTIONS_MILES,
} from '@/features/listings/utils/geoDistance';

describe('geoDistance', () => {
  it('converts miles to kilometers', () => {
    expect(milesToKm(1)).toBeCloseTo(1.60934, 5);
    expect(milesToKm(25)).toBeCloseTo(40.2335, 3);
    expect(milesToKm(300)).toBeCloseTo(482.802, 2);
  });

  it('clamps radius miles to supported range', () => {
    expect(clampRadiusMiles(1)).toBe(MIN_RADIUS_MILES);
    expect(clampRadiusMiles(50)).toBe(50);
    expect(clampRadiusMiles(500)).toBe(MAX_RADIUS_MILES);
  });

  it('normalizes radius miles to dropdown options', () => {
    expect(RADIUS_OPTIONS_MILES).toEqual([5, 10, 20, 50, 100, 300]);
    expect(normalizeRadiusMiles(10)).toBe(10);
    expect(normalizeRadiusMiles(25)).toBe(20);
    expect(normalizeRadiusMiles(75)).toBe(50);
  });
});

describe('listingSearchCacheKey geo params', () => {
  it('includes lat, lng, and radiusKm in cache key', () => {
    const key = listingSearchCacheKey({
      communityId: 'all',
      lat: 42.3314,
      lng: -83.0458,
      radiusKm: 40.2335,
      page: 1,
    });

    expect(key).toContain('lat=42.3314');
    expect(key).toContain('lng=-83.0458');
    expect(key).toContain('radiusKm=40.2335');
  });
});
