import { describe, expect, it } from 'vitest';

import {
  BROWSE_MAP_AGGREGATE_RADIUS_MILES,
  BROWSE_MAP_AGGREGATED_PIN_COLOR,
  BROWSE_MAP_LOCATION_PRECISION,
  BROWSE_MAP_SINGLE_PIN_COLOR,
  aggregateBrowseMapPins,
  browseMapPinGroupKey,
  browseMapPinGroupsSyncKey,
  buildBrowseMapListingsCacheKey,
  browseMapPinIconSvg,
  browseMapPinLabelConfig,
  isBrowseMapPinGroupFullyUnavailable,
  locationBucketKey,
  shouldPanMapOnPinClick,
} from '@/features/listings/utils/browseMapPinAggregation';
import type { Listing } from '@/types';

function makeListing(
  id: string,
  sellerId: string,
  lat: number,
  lng: number,
  title = `Listing ${id}`,
): Listing {
  return {
    id,
    title,
    description: '',
    price: 100,
    imageUrl: '',
    imageUrls: [],
    sellerId,
    sellerName: 'Seller',
    communityIds: [],
    primaryCategoryId: 'cat',
    status: 'active',
    location: { lat, lng },
  };
}

describe('browseMapPinAggregation', () => {
  it('uses sellerId plus rounded centroid coordinates as the group key', () => {
    expect(locationBucketKey(38.75012, -77.47098)).toBe('38.7501:-77.4710');
    expect(browseMapPinGroupKey('seller-a', 38.75012, -77.47098)).toBe(
      'seller-a:38.7501:-77.4710',
    );
    expect(BROWSE_MAP_LOCATION_PRECISION).toBe(4);
    expect(BROWSE_MAP_AGGREGATE_RADIUS_MILES).toBe(0.02);
  });

  it('aggregates multiple listings from the same seller at nearby coordinates', () => {
    const listings = [
      makeListing('l1', 'seller-a', 38.75011, -77.47091, 'Alpha'),
      makeListing('l2', 'seller-a', 38.75014, -77.47096, 'Beta'),
    ];

    const groups = aggregateBrowseMapPins(listings);

    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('aggregated');
    expect(groups[0].listings.map((listing) => listing.id)).toEqual(['l1', 'l2']);
    expect(groups[0].position.lat).toBeCloseTo(38.750125, 5);
    expect(groups[0].position.lng).toBeCloseTo(-77.470935, 5);
  });

  it('keeps same seller listings at different locations as separate pins', () => {
    const listings = [
      makeListing('l1', 'seller-a', 38.75, -77.47),
      makeListing('l2', 'seller-a', 38.76, -77.48),
    ];

    const groups = aggregateBrowseMapPins(listings);

    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.kind === 'single')).toBe(true);
  });

  it('keeps different sellers at the same coordinates as separate pins', () => {
    const listings = [
      makeListing('l1', 'seller-a', 38.75, -77.47),
      makeListing('l2', 'seller-b', 38.75, -77.47),
    ];

    const groups = aggregateBrowseMapPins(listings);

    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.kind === 'single')).toBe(true);
    expect(new Set(groups.map((group) => group.sellerId))).toEqual(new Set(['seller-a', 'seller-b']));
  });

  it('skips listings without coordinates or sellerId', () => {
    const listings = [
      makeListing('l1', 'seller-a', 38.75, -77.47),
      { ...makeListing('l2', 'seller-a', 38.75, -77.47), location: undefined },
      { ...makeListing('l3', '', 38.75, -77.47), sellerId: '' },
    ];

    expect(aggregateBrowseMapPins(listings)).toHaveLength(1);
  });

  it('builds a stable sync key for marker refresh', () => {
    const groups = aggregateBrowseMapPins([
      makeListing('l2', 'seller-a', 38.75011, -77.47091),
      makeListing('l1', 'seller-a', 38.75014, -77.47096),
    ]);

    expect(browseMapPinGroupsSyncKey(groups)).toContain('l1|l2');
  });

  it('memoizes pin aggregation for unchanged listing snapshots', () => {
    const listings = [
      makeListing('l1', 'seller-a', 38.75011, -77.47091),
      makeListing('l2', 'seller-a', 38.75014, -77.47096),
    ];

    const first = aggregateBrowseMapPins(listings);
    const second = aggregateBrowseMapPins([...listings]);

    expect(second).toBe(first);
  });

  it('builds a stable cache key from listing ids and coordinates', () => {
    const listings = [
      makeListing('l2', 'seller-a', 38.75011, -77.47091),
      makeListing('l1', 'seller-a', 38.75014, -77.47096),
    ];

    expect(buildBrowseMapListingsCacheKey(listings)).toContain('l1:seller-a');
    expect(buildBrowseMapListingsCacheKey(listings)).toContain('l2:seller-a');
  });

  it('tracks unavailable state per pin group', () => {
    const group = aggregateBrowseMapPins([makeListing('l1', 'seller-a', 38.75, -77.47)])[0];
    const unavailable = new Set<string>();

    expect(isBrowseMapPinGroupFullyUnavailable(group, unavailable)).toBe(false);

    unavailable.add('l1');
    expect(isBrowseMapPinGroupFullyUnavailable(group, unavailable)).toBe(true);
  });

  it('skips map pan when dismissing a pinned marker popup', () => {
    expect(shouldPanMapOnPinClick('pin-a', 'pin-a', true)).toBe(false);
    expect(shouldPanMapOnPinClick('pin-a', 'pin-b', true)).toBe(true);
  });

  it('uses brand colors for single and aggregated pin SVG', () => {
    expect(browseMapPinIconSvg('single')).toContain(BROWSE_MAP_SINGLE_PIN_COLOR);
    expect(browseMapPinIconSvg('aggregated')).toContain(BROWSE_MAP_AGGREGATED_PIN_COLOR);
  });

  it('shows a count label only on aggregated pins', () => {
    const single = aggregateBrowseMapPins([makeListing('l1', 'seller-a', 38.75, -77.47)])[0];
    const aggregated = aggregateBrowseMapPins([
      makeListing('l1', 'seller-a', 38.75011, -77.47091),
      makeListing('l2', 'seller-a', 38.75014, -77.47096),
    ])[0];

    expect(browseMapPinLabelConfig(single)).toBeUndefined();
    expect(browseMapPinLabelConfig(aggregated)).toEqual({
      text: '2',
      color: '#ffffff',
      fontSize: '11px',
      fontWeight: '700',
    });
  });
});
