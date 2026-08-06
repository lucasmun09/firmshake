import { describe, expect, it } from 'vitest';

import { encodeGeohash, haversineDistanceKm } from '@/features/listings/utils/geohash';

describe('geohash', () => {
  it('encodes known coordinates consistently', () => {
    const hash = encodeGeohash({ lat: 37.7749, lng: -122.4194 }, 9);
    expect(hash).toHaveLength(9);
    expect(hash).toMatch(/^[0-9b-hjkmnp-z]+$/);
  });

  it('computes haversine distance', () => {
    const distance = haversineDistanceKm(
      { lat: 37.7749, lng: -122.4194 },
      { lat: 37.8044, lng: -122.2712 },
    );
    expect(distance).toBeGreaterThan(10);
    expect(distance).toBeLessThan(20);
  });
});
