import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

let loadPromise: Promise<void> | null = null;
let optionsSet = false;

export function isGoogleMapsConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim());
}

export function registerGoogleMapsAuthFailure(onFailure: () => void): void {
  (window as Window & { gm_authFailure?: () => void }).gm_authFailure = onFailure;
}

export async function loadGoogleMaps(): Promise<typeof google> {
  if (!isGoogleMapsConfigured()) {
    throw new Error(
      'Google Maps is not configured. Set VITE_GOOGLE_MAPS_API_KEY in .env.local',
    );
  }

  if (!loadPromise) {
    if (!optionsSet) {
      setOptions({
        key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
        v: 'weekly',
      });
      optionsSet = true;
    }

    loadPromise = importLibrary('places').then(() => undefined);
  }

  await loadPromise;
  return google;
}

export async function loadGeocoder(): Promise<google.maps.Geocoder> {
  await loadGoogleMaps();
  const { Geocoder } = (await google.maps.importLibrary(
    'geocoding',
  )) as google.maps.GeocodingLibrary;
  return new Geocoder();
}

export async function loadMapsLibrary(): Promise<google.maps.MapsLibrary> {
  await loadGoogleMaps();
  return (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary;
}

export interface CityRegion {
  city?: string;
  region?: string;
}

export async function reverseGeocodeCityRegion(
  lat: number,
  lng: number,
): Promise<CityRegion> {
  const geocoder = await loadGeocoder();
  const { results } = await geocoder.geocode({
    location: { lat, lng },
  });

  if (results.length === 0) {
    return {};
  }

  let city: string | undefined;
  let region: string | undefined;

  for (const result of results) {
    for (const component of result.address_components) {
      if (
        !city &&
        (component.types.includes('locality') ||
          component.types.includes('postal_town') ||
          component.types.includes('sublocality'))
      ) {
        city = component.long_name;
      }
      if (!region && component.types.includes('administrative_area_level_1')) {
        region = component.short_name;
      }
    }
    if (city && region) {
      break;
    }
  }

  return { city, region };
}

const REVERSE_GEOCODE_TYPES = [
  'street_address',
  'premise',
  'subpremise',
  'route',
  'intersection',
  'neighborhood',
  'sublocality',
  'locality',
] as const;

export interface ForwardGeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  city?: string;
  region?: string;
}

export async function forwardGeocodeAddress(address: string): Promise<ForwardGeocodeResult> {
  const query = address.trim();
  if (!query) {
    throw new Error('Enter a location to geocode.');
  }

  const geocoder = await loadGeocoder();
  const { results } = await geocoder.geocode({ address: query });

  if (results.length === 0) {
    throw new Error('Could not find coordinates for that location.');
  }

  const result = results[0];
  const location = result.geometry.location;
  const { city, region } = (() => {
    let resolvedCity: string | undefined;
    let resolvedRegion: string | undefined;

    for (const component of result.address_components) {
      if (
        !resolvedCity &&
        (component.types.includes('locality') ||
          component.types.includes('postal_town') ||
          component.types.includes('sublocality'))
      ) {
        resolvedCity = component.long_name;
      }
      if (!resolvedRegion && component.types.includes('administrative_area_level_1')) {
        resolvedRegion = component.short_name;
      }
    }

    return { city: resolvedCity, region: resolvedRegion };
  })();

  return {
    lat: location.lat(),
    lng: location.lng(),
    formattedAddress: result.formatted_address,
    city,
    region,
  };
}

export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number,
): Promise<string> {
  const geocoder = await loadGeocoder();
  const { results } = await geocoder.geocode({
    location: { lat, lng },
  });

  if (results.length === 0) {
    throw new Error(
      'Could not find an address near your location. Enable Geocoding API in Google Cloud Console.',
    );
  }

  for (const type of REVERSE_GEOCODE_TYPES) {
    const match = results.find((result) => result.types.includes(type));
    if (match?.formatted_address) {
      return match.formatted_address;
    }
  }

  const fallback = results.find(
    (result) => !result.types.includes('plus_code') && result.formatted_address,
  );
  if (fallback?.formatted_address) {
    return fallback.formatted_address;
  }

  return results[0].formatted_address;
}
