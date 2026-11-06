import { buildUserCacheKey } from '@/common/services/responseCache';
import {
  DEFAULT_RADIUS_MILES,
  normalizeRadiusMiles,
} from '@/features/listings/utils/geoDistance';

const STORAGE_PREFIX = 'firmshake-prefs:';
const PREFS_NAMESPACE = 'browse-geo-filter';
export const GEO_FILTER_OWNER_UID_KEY = `${STORAGE_PREFIX}${PREFS_NAMESPACE}:owner-uid`;

export interface StoredGeoFilterPrefs {
  lat: number;
  lng: number;
  radiusMiles: number;
  label?: string;
  city?: string;
  region?: string;
}

export interface GeoFilterState {
  enabled: boolean;
  lat: number | null;
  lng: number | null;
  radiusMiles: number;
  label: string;
  city: string;
  region: string;
}

export function defaultGeoFilterState(): GeoFilterState {
  return {
    enabled: true,
    lat: null,
    lng: null,
    radiusMiles: DEFAULT_RADIUS_MILES,
    label: '',
    city: '',
    region: '',
  };
}

/** localStorage key: firmshake-prefs:browse-geo-filter:uid={uid} */
export function geoFilterPrefsStorageKey(uid: string): string {
  return `${STORAGE_PREFIX}${buildUserCacheKey(uid, PREFS_NAMESPACE)}`;
}

function isStorageAvailable(): boolean {
  return typeof localStorage !== 'undefined';
}

function buildStoredPrefs(state: GeoFilterState): StoredGeoFilterPrefs {
  return {
    lat: state.lat!,
    lng: state.lng!,
    radiusMiles: normalizeRadiusMiles(state.radiusMiles),
    label: state.label || undefined,
    city: state.city || undefined,
    region: state.region || undefined,
  };
}

function prefsEqual(
  left: StoredGeoFilterPrefs,
  right: StoredGeoFilterPrefs,
): boolean {
  return (
    left.lat === right.lat &&
    left.lng === right.lng &&
    left.radiusMiles === right.radiusMiles &&
    (left.label ?? '') === (right.label ?? '') &&
    (left.city ?? '') === (right.city ?? '') &&
    (left.region ?? '') === (right.region ?? '')
  );
}

/** Best-effort city/region extraction from a comma-separated address label. */
export function parseCityRegionFromAddress(address: string): {
  city: string;
  region: string;
} {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const region = parts[parts.length - 2] ?? '';
    const city = parts[parts.length - 3] ?? '';
    return { city, region };
  }
  if (parts.length === 2) {
    return { city: parts[0], region: parts[1] };
  }
  return { city: '', region: '' };
}

export function loadGeoFilterPrefs(uid: string): StoredGeoFilterPrefs | null {
  if (!isStorageAvailable()) {
    return null;
  }

  try {
    const raw = localStorage.getItem(geoFilterPrefsStorageKey(uid));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredGeoFilterPrefs;
    if (
      typeof parsed.lat !== 'number' ||
      typeof parsed.lng !== 'number' ||
      !Number.isFinite(parsed.lat) ||
      !Number.isFinite(parsed.lng)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveGeoFilterPrefs(uid: string, state: GeoFilterState): void {
  if (!isStorageAvailable()) {
    return;
  }

  if (state.lat == null || state.lng == null) {
    clearGeoFilterPrefs(uid);
    return;
  }

  const prefs = buildStoredPrefs(state);
  const existing = loadGeoFilterPrefs(uid);
  if (existing && prefsEqual(existing, prefs)) {
    return;
  }

  try {
    localStorage.setItem(geoFilterPrefsStorageKey(uid), JSON.stringify(prefs));
  } catch {
    // Ignore quota errors.
  }
}

export function clearGeoFilterPrefs(uid: string): void {
  if (!isStorageAvailable()) {
    return;
  }

  try {
    localStorage.removeItem(geoFilterPrefsStorageKey(uid));
  } catch {
    // Ignore storage errors.
  }
}

export function hydrateGeoFilterFromPrefs(
  uid: string,
  base: GeoFilterState = defaultGeoFilterState(),
): GeoFilterState {
  const prefs = loadGeoFilterPrefs(uid);
  if (!prefs) {
    return base;
  }

  return {
    enabled: true,
    lat: prefs.lat,
    lng: prefs.lng,
    radiusMiles: normalizeRadiusMiles(prefs.radiusMiles ?? base.radiusMiles),
    label: prefs.label ?? base.label,
    city: prefs.city ?? base.city,
    region: prefs.region ?? base.region,
  };
}

export function getGeoFilterPrefsOwnerUid(): string | null {
  if (!isStorageAvailable()) {
    return null;
  }

  return localStorage.getItem(GEO_FILTER_OWNER_UID_KEY);
}

export function setGeoFilterPrefsOwnerUid(uid: string): void {
  if (!isStorageAvailable()) {
    return;
  }

  localStorage.setItem(GEO_FILTER_OWNER_UID_KEY, uid);
}

/** Clears the previous owner's stored location when the signed-in user changes. */
export function clearGeoFilterPrefsIfUserChanged(uid: string): void {
  const owner = getGeoFilterPrefsOwnerUid();
  if (owner && owner !== uid) {
    clearGeoFilterPrefs(owner);
  }

  setGeoFilterPrefsOwnerUid(uid);
}

export function initGeoFilterStorageOnPageLoad(): void {
  if (getGeoFilterPrefsOwnerUid()) {
    return;
  }

  setGeoFilterPrefsOwnerUid('anonymous');
}
