import { describe, expect, it } from 'vitest';

import {
  BROWSE_MAP_DEFAULT_RADIUS_MILES,
  BROWSE_MAP_STYLES,
  BROWSE_MAP_SEARCH_PAGE_SIZE,
  latLngBoundsForRadius,
  listingDetailPath,
  truncateDescription,
  viewportBoundsToSearch,
  viewportFromCenterRadius,
} from '@/features/listings/utils/browseMapView';

describe('browseMapView utils', () => {
  it('builds listing detail route', () => {
    expect(listingDetailPath('abc-123')).toBe('/listing/abc-123');
  });

  it('truncates long descriptions with ellipsis', () => {
    const long = 'a'.repeat(150);
    expect(truncateDescription(long, 120).length).toBe(120);
    expect(truncateDescription(long, 120).endsWith('…')).toBe(true);
    expect(truncateDescription('short text')).toBe('short text');
  });

  it('hides POI labels in map styles', () => {
    const poiStyle = BROWSE_MAP_STYLES.find((style) => style.featureType === 'poi');
    expect(poiStyle?.stylers?.[0]).toEqual({ visibility: 'off' });
  });

  it('converts map bounds to a viewport search radius', () => {
    const bounds = {
      getNorthEast: () => ({ lat: () => 39, lng: () => -77 }),
      getSouthWest: () => ({ lat: () => 38.5, lng: () => -78 }),
    } as google.maps.LatLngBounds;

    const viewport = viewportBoundsToSearch(bounds, 12);

    expect(viewport.lat).toBeCloseTo(38.75, 5);
    expect(viewport.lng).toBeCloseTo(-77.5, 5);
    expect(viewport.radiusMiles).toBeGreaterThanOrEqual(5);
    expect(viewport.north).toBe(39);
    expect(viewport.south).toBe(38.5);
    expect(viewport.east).toBe(-77);
    expect(viewport.west).toBe(-78);
    expect(viewport.zoom).toBe(12);
  });

  it('requests up to 100 listings per map viewport fetch', () => {
    expect(BROWSE_MAP_SEARCH_PAGE_SIZE).toBe(100);
  });

  it('builds bounds for a 5 mile radius around a center', () => {
    const bounds = latLngBoundsForRadius(38.9, -77.0, BROWSE_MAP_DEFAULT_RADIUS_MILES);
    expect(bounds.north).toBeGreaterThan(38.9);
    expect(bounds.south).toBeLessThan(38.9);
    expect(bounds.east).toBeGreaterThan(-77.0);
    expect(bounds.west).toBeLessThan(-77.0);
  });

  it('builds a viewport search from center and radius', () => {
    const viewport = viewportFromCenterRadius(38.9, -77.0, 5);
    expect(viewport.radiusMiles).toBe(5);
    expect(viewport.lat).toBe(38.9);
    expect(viewport.lng).toBe(-77.0);
  });
});
