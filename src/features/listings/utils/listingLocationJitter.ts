import { haversineDistanceMiles } from '@/features/listings/utils/geoDistance';

export const LISTING_MAP_JITTER_MAX_MILES = 0.5;
export const LISTING_MAP_DISPLAY_RADIUS_MILES = 1;

export interface LatLng {
  lat: number;
  lng: number;
}

export function hashStringToSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function offsetByMilesAndBearing(
  lat: number,
  lng: number,
  distanceMiles: number,
  bearingRadians: number,
): LatLng {
  const earthRadiusMiles = 3958.8;
  const angularDistance = distanceMiles / earthRadiusMiles;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  const destLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRadians),
  );
  const destLngRad =
    lngRad +
    Math.atan2(
      Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(destLatRad),
    );

  return {
    lat: (destLatRad * 180) / Math.PI,
    lng: (destLngRad * 180) / Math.PI,
  };
}

export function jitterListingMapCenter(
  listingId: string,
  lat: number,
  lng: number,
): LatLng {
  const seed = hashStringToSeed(listingId);
  const distanceRng = mulberry32(seed);
  const bearingRng = mulberry32(seed ^ 0x9e3779b9);

  const distanceMiles = distanceRng() * LISTING_MAP_JITTER_MAX_MILES;
  const bearingRadians = bearingRng() * Math.PI * 2;

  return offsetByMilesAndBearing(lat, lng, distanceMiles, bearingRadians);
}

export function jitterOffsetMiles(
  listingId: string,
  lat: number,
  lng: number,
): number {
  const jittered = jitterListingMapCenter(listingId, lat, lng);
  return haversineDistanceMiles(lat, lng, jittered.lat, jittered.lng);
}
