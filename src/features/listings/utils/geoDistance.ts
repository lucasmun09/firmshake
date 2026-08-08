export const MIN_RADIUS_MILES = 5;
export const MAX_RADIUS_MILES = 300;
export const DEFAULT_RADIUS_MILES = 10;
export const RADIUS_OPTIONS_MILES = [5, 10, 20, 50, 100, 300] as const;

const MILES_TO_KM = 1.60934;

export function milesToKm(miles: number): number {
  return miles * MILES_TO_KM;
}

export function clampRadiusMiles(miles: number): number {
  return Math.min(MAX_RADIUS_MILES, Math.max(MIN_RADIUS_MILES, miles));
}

export function normalizeRadiusMiles(miles: number): number {
  const clamped = clampRadiusMiles(miles);
  if (RADIUS_OPTIONS_MILES.includes(clamped as (typeof RADIUS_OPTIONS_MILES)[number])) {
    return clamped;
  }

  return RADIUS_OPTIONS_MILES.reduce((closest, option) =>
    Math.abs(option - clamped) < Math.abs(closest - clamped) ? option : closest,
  );
}

export function milesToMeters(miles: number): number {
  return milesToKm(miles) * 1000;
}

const EARTH_RADIUS_MILES = 3958.8;

export function haversineDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}
