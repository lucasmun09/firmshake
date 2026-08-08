import { clampRadiusMiles, haversineDistanceMiles } from '@/features/listings/utils/geoDistance';

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
export const BROWSE_MAP_SEARCH_PAGE_SIZE = 100;
export const BROWSE_MAP_DEFAULT_RADIUS_MILES = 5;

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
