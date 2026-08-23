import {
  BROWSE_MAP_MAX_PREFETCH_PAGES,
  BROWSE_MAP_SEARCH_PAGE_SIZE,
} from '@/features/listings/utils/browsePaginationConfig';
import { clampRadiusMiles, haversineDistanceMiles } from '@/features/listings/utils/geoDistance';

export { BROWSE_MAP_MAX_PREFETCH_PAGES, BROWSE_MAP_SEARCH_PAGE_SIZE };

/** Map styles that hide default POI/landmark labels and reduce click targets. */
export const BROWSE_MAP_STYLES: google.maps.MapTypeStyle[] = [
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.business',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
];

export const BROWSE_MAP_HOVER_DELAY_MS = 250;
export const BROWSE_MAP_HIDE_DELAY_MS = 300;
export const BROWSE_MAP_BOUNDS_DEBOUNCE_MS = 350;
export const BROWSE_MAP_DEFAULT_RADIUS_MILES = 5;

/** Map events that reposition the listing popup (pan/zoom/drag, including programmatic panTo). */
export const BROWSE_MAP_POPUP_REPOSITION_EVENTS = [
  'center_changed',
  'bounds_changed',
  'zoom_changed',
  'drag',
] as const;

/** Map events that dismiss the listing popup (user gesture only — not programmatic panTo). */
export const BROWSE_MAP_POPUP_DISMISS_EVENTS = ['dragstart'] as const;

export function shouldDismissMapListingPopupOnMapEvent(eventName: string): boolean {
  return (BROWSE_MAP_POPUP_DISMISS_EVENTS as readonly string[]).includes(eventName);
}

export interface MapViewportSearch {
  lat: number;
  lng: number;
  radiusMiles: number;
  north: number;
  south: number;
  east: number;
  west: number;
  /** Integer zoom level for map cache buckets. */
  zoom: number;
}

/** Convert visible map bounds to a center + radius search for the browse API. */
export function viewportBoundsToSearch(
  bounds: google.maps.LatLngBounds,
  zoom: number,
): MapViewportSearch {
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const lat = (ne.lat() + sw.lat()) / 2;
  const lng = (ne.lng() + sw.lng()) / 2;
  const cornerDistances = [
    haversineDistanceMiles(lat, lng, ne.lat(), ne.lng()),
    haversineDistanceMiles(lat, lng, sw.lat(), sw.lng()),
    haversineDistanceMiles(lat, lng, ne.lat(), sw.lng()),
    haversineDistanceMiles(lat, lng, sw.lat(), ne.lng()),
  ];
  const radiusMiles = clampRadiusMiles(Math.ceil(Math.max(...cornerDistances)));

  return {
    lat,
    lng,
    radiusMiles,
    north: ne.lat(),
    south: sw.lat(),
    east: ne.lng(),
    west: sw.lng(),
    zoom: Math.round(zoom),
  };
}

export function listingDetailPath(listingId: string): string {
  return `/listing/${listingId}`;
}

export function truncateDescription(description: string, maxLength = 120): string {
  const trimmed = description.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

/** True when hover is unreliable (touch-first devices). */
export function isCoarsePointer(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.matchMedia('(pointer: coarse)').matches;
}

/** Approximate LatLng bounds enclosing a circle with the given radius in miles. */
export function latLngBoundsForRadius(
  lat: number,
  lng: number,
  radiusMiles: number,
): { north: number; south: number; east: number; west: number } {
  const latDelta = radiusMiles / 69;
  const lngDelta = radiusMiles / (69 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));

  return {
    north: lat + latDelta,
    south: lat - latDelta,
    east: lng + lngDelta,
    west: lng - lngDelta,
  };
}

export function resolveMapSearchViewport(
  viewport: MapViewportSearch,
  geo: { lat: number; lng: number; radiusMiles: number } | null,
): MapViewportSearch {
  if (!geo) {
    return viewport;
  }

  return viewportFromCenterRadius(geo.lat, geo.lng, geo.radiusMiles, viewport.zoom);
}

export function viewportFromCenterRadius(
  lat: number,
  lng: number,
  radiusMiles: number,
  zoom = 11,
): MapViewportSearch {
  const bounds = latLngBoundsForRadius(lat, lng, radiusMiles);
  return {
    lat,
    lng,
    radiusMiles: clampRadiusMiles(radiusMiles),
    ...bounds,
    zoom: Math.round(zoom),
  };
}

export interface MapGeoSearchPayload {
  lat: number;
  lng: number;
  label: string;
  radiusMiles: number;
  city?: string;
  region?: string;
}

/** Skip pan when the same pinned marker is clicked to dismiss its popup. */
export function shouldPanMapOnMarkerClick(
  activeListingId: string | null | undefined,
  clickedListingId: string,
  popupPinned: boolean,
): boolean {
  return !(activeListingId === clickedListingId && popupPinned);
}

export function latLngToContainerPixel(
  map: google.maps.Map,
  projection: google.maps.MapCanvasProjection,
  latLng: google.maps.LatLngLiteral,
): { x: number; y: number } | null {
  const point = projection.fromLatLngToContainerPixel(
    new google.maps.LatLng(latLng.lat, latLng.lng),
  );
  if (!point) {
    return null;
  }
  return { x: point.x, y: point.y };
}

/** Estimated popup card height for pin-click pan offset (matches typical card with image). */
export const BROWSE_MAP_POPUP_ESTIMATED_HEIGHT_PX = 240;

/** Visible gap between popup bottom edge and the top of the pin marker icon. */
export const BROWSE_MAP_POPUP_PIN_GAP_PX = 36;

/** Approximate pin marker icon height (anchor is at the tip; body extends upward). */
export const BROWSE_MAP_MARKER_HEIGHT_PX = 40;

/** Total popup transform offset above the pin anchor (gap + marker clearance). */
export const BROWSE_MAP_POPUP_ANCHOR_OFFSET_PX =
  BROWSE_MAP_POPUP_PIN_GAP_PX + BROWSE_MAP_MARKER_HEIGHT_PX;

/** Target pin screen Y as a fraction of map height (pin sits in lower viewport). */
export const BROWSE_MAP_PIN_TARGET_FRACTION = 0.89;

/** Upper bound for pin screen Y so small map containers stay usable. */
export const BROWSE_MAP_PIN_TARGET_MAX_FRACTION = 0.9;

/** Minimum inset from the top edge so the popup card stays fully visible. */
export const BROWSE_MAP_POPUP_TOP_PADDING_PX = 12;

/**
 * Target screen Y for the pin after a click pan so the popup sits in the
 * upper-middle viewport with the pin clearly visible below the card.
 */
export function computePinClickTargetPinY(
  mapContainerHeightPx: number,
  popupHeightPx = BROWSE_MAP_POPUP_ESTIMATED_HEIGHT_PX,
): number {
  const idealPinY = mapContainerHeightPx * BROWSE_MAP_PIN_TARGET_FRACTION;
  const maxPinY = mapContainerHeightPx * BROWSE_MAP_PIN_TARGET_MAX_FRACTION;
  const minPinY =
    popupHeightPx +
    BROWSE_MAP_POPUP_ANCHOR_OFFSET_PX +
    BROWSE_MAP_POPUP_TOP_PADDING_PX;
  return Math.max(minPinY, Math.min(idealPinY, maxPinY));
}

/**
 * Vertical panBy offset after panTo(marker): negative values shift the map up so
 * the pin moves down on screen toward {@link computePinClickTargetPinY}.
 *
 * Google Maps panBy(0, y): positive y pans the map south (markers move up);
 * negative y pans north (markers move down).
 */
export function computePinClickPanByOffset(
  mapContainerHeightPx: number,
  popupHeightPx = BROWSE_MAP_POPUP_ESTIMATED_HEIGHT_PX,
): number {
  const mapCenterY = mapContainerHeightPx / 2;
  const targetPinY = computePinClickTargetPinY(mapContainerHeightPx, popupHeightPx);
  return -(targetPinY - mapCenterY);
}
