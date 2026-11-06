const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

/** Encode lat/lng to geohash string (precision 1–12). Default precision 9 ≈ 5m. */
export function encodeGeohash({ lat, lng }: GeoCoordinates, precision = 9): string {
  let minLat = -90;
  let maxLat = 90;
  let minLng = -180;
  let maxLng = 180;
  let hash = '';
  let bit = 0;
  let ch = 0;
  let isLng = true;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) {
        ch = ch | (1 << (4 - bit));
        minLng = mid;
      } else {
        maxLng = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) {
        ch = ch | (1 << (4 - bit));
        minLat = mid;
      } else {
        maxLat = mid;
      }
    }

    isLng = !isLng;
    if (bit < 4) {
      bit += 1;
    } else {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

/** Neighbor geohash prefixes for radius-style queries (same-length prefixes). */
export function geohashPrefixesForRadius(center: GeoCoordinates, radiusKm: number): string[] {
  const precision = radiusKm <= 1 ? 7 : radiusKm <= 5 ? 6 : radiusKm <= 20 ? 5 : 4;
  const centerHash = encodeGeohash(center, precision);
  return [centerHash];
}

export function haversineDistanceKm(a: GeoCoordinates, b: GeoCoordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
