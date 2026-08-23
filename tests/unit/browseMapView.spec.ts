import { describe, expect, it } from 'vitest';

import {
  BROWSE_MAP_DEFAULT_RADIUS_MILES,
  BROWSE_MAP_MARKER_HEIGHT_PX,
  BROWSE_MAP_PIN_TARGET_FRACTION,
  BROWSE_MAP_PIN_TARGET_MAX_FRACTION,
  BROWSE_MAP_POPUP_ANCHOR_OFFSET_PX,
  BROWSE_MAP_POPUP_ESTIMATED_HEIGHT_PX,
  BROWSE_MAP_POPUP_PIN_GAP_PX,
  BROWSE_MAP_POPUP_TOP_PADDING_PX,
  BROWSE_MAP_POPUP_DISMISS_EVENTS,
  BROWSE_MAP_POPUP_REPOSITION_EVENTS,
  BROWSE_MAP_STYLES,
  BROWSE_MAP_MAX_PREFETCH_PAGES,
  BROWSE_MAP_SEARCH_PAGE_SIZE,
  computePinClickPanByOffset,
  computePinClickTargetPinY,
  latLngBoundsForRadius,
  listingDetailPath,
  resolveMapSearchViewport,
  shouldDismissMapListingPopupOnMapEvent,
  shouldPanMapOnMarkerClick,
  truncateDescription,
  viewportBoundsToSearch,
  viewportFromCenterRadius,
} from '@/features/listings/utils/browseMapView';

describe('browseMapView utils', () => {
  it('builds listing detail route', () => {
    expect(listingDetailPath('abc-123')).toBe('/listing/abc-123');
  });

  it('skips map pan when dismissing a pinned marker popup', () => {
    expect(shouldPanMapOnMarkerClick('listing-a', 'listing-a', true)).toBe(false);
    expect(shouldPanMapOnMarkerClick('listing-a', 'listing-a', false)).toBe(true);
    expect(shouldPanMapOnMarkerClick('listing-a', 'listing-b', true)).toBe(true);
    expect(shouldPanMapOnMarkerClick(undefined, 'listing-a', false)).toBe(true);
  });

  it('repositions popup during programmatic pan and user drag', () => {
    expect(BROWSE_MAP_POPUP_REPOSITION_EVENTS).toContain('center_changed');
    expect(BROWSE_MAP_POPUP_REPOSITION_EVENTS).toContain('drag');
    expect(BROWSE_MAP_POPUP_REPOSITION_EVENTS).not.toContain('dragend');
  });

  it('dismisses pinned popup on user drag start only', () => {
    expect(BROWSE_MAP_POPUP_DISMISS_EVENTS).toEqual(['dragstart']);
    expect(shouldDismissMapListingPopupOnMapEvent('dragstart')).toBe(true);
    expect(shouldDismissMapListingPopupOnMapEvent('drag')).toBe(false);
    expect(shouldDismissMapListingPopupOnMapEvent('center_changed')).toBe(false);
    expect(shouldDismissMapListingPopupOnMapEvent('zoom_changed')).toBe(false);
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

  it('limits map viewport prefetch to a bounded page depth', () => {
    expect(BROWSE_MAP_MAX_PREFETCH_PAGES).toBe(3);
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

  it('prefers sidebar geo center and radius over panned map viewport', () => {
    const pannedViewport = viewportFromCenterRadius(39.5, -76.0, 80, 9);
    const resolved = resolveMapSearchViewport(pannedViewport, {
      lat: 38.9,
      lng: -77.0,
      radiusMiles: 20,
    });

    expect(resolved.lat).toBe(38.9);
    expect(resolved.lng).toBe(-77.0);
    expect(resolved.radiusMiles).toBe(20);
    expect(resolved.zoom).toBe(9);
  });

  it('targets pin in lower viewport so popup sits above with clearance', () => {
    const height = 520;
    const centerY = height / 2;
    const targetPinY = computePinClickTargetPinY(height);

    expect(targetPinY).toBeGreaterThan(centerY);
    expect(targetPinY / height).toBeCloseTo(BROWSE_MAP_PIN_TARGET_FRACTION, 5);
    expect(targetPinY / height).toBeLessThanOrEqual(BROWSE_MAP_PIN_TARGET_MAX_FRACTION);
    expect(targetPinY).toBe(height * BROWSE_MAP_PIN_TARGET_FRACTION);
  });

  it('includes marker height and gap in popup anchor offset', () => {
    expect(BROWSE_MAP_POPUP_ANCHOR_OFFSET_PX).toBe(
      BROWSE_MAP_POPUP_PIN_GAP_PX + BROWSE_MAP_MARKER_HEIGHT_PX,
    );
    expect(BROWSE_MAP_POPUP_PIN_GAP_PX).toBeGreaterThanOrEqual(32);
    expect(BROWSE_MAP_MARKER_HEIGHT_PX).toBe(40);
  });

  it('clamps pin target on short map containers so popup stays visible', () => {
    const height = 280;
    const minPinY =
      BROWSE_MAP_POPUP_ESTIMATED_HEIGHT_PX +
      BROWSE_MAP_POPUP_ANCHOR_OFFSET_PX +
      BROWSE_MAP_POPUP_TOP_PADDING_PX;
    const targetPinY = computePinClickTargetPinY(height);

    expect(targetPinY).toBe(minPinY);
    expect(targetPinY).toBeGreaterThan(height * BROWSE_MAP_PIN_TARGET_MAX_FRACTION);
    expect(computePinClickPanByOffset(height)).toBe(-(targetPinY - height / 2));
  });

  it('uses measured popup height when computing pin target', () => {
    const height = 520;
    const measuredPopupHeight = 310;
    const targetPinY = computePinClickTargetPinY(height, measuredPopupHeight);
    const minPinY =
      measuredPopupHeight +
      BROWSE_MAP_POPUP_ANCHOR_OFFSET_PX +
      BROWSE_MAP_POPUP_TOP_PADDING_PX;

    expect(targetPinY).toBeGreaterThanOrEqual(minPinY);
    expect(computePinClickPanByOffset(height, measuredPopupHeight)).toBe(
      -(targetPinY - height / 2),
    );
  });

  it('computes negative panBy offset to move pin down after panTo', () => {
    expect(computePinClickPanByOffset(520)).toBe(-(520 * BROWSE_MAP_PIN_TARGET_FRACTION - 260));
    expect(computePinClickPanByOffset(400)).toBe(-(400 * BROWSE_MAP_PIN_TARGET_FRACTION - 200));
  });

  it('keeps popup top inset when pin target is clamped', () => {
    const height = 280;
    const targetPinY = computePinClickTargetPinY(height);
    const popupTop =
      targetPinY - BROWSE_MAP_POPUP_ANCHOR_OFFSET_PX - BROWSE_MAP_POPUP_ESTIMATED_HEIGHT_PX;

    expect(popupTop).toBeGreaterThanOrEqual(BROWSE_MAP_POPUP_TOP_PADDING_PX);
  });
});
