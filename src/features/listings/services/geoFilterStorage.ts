import { buildUserCacheKey } from '@/common/services/responseCache';
import {
  clampRadiusMiles,
  DEFAULT_RADIUS_MILES,
} from '@/features/listings/utils/geoDistance';

const STORAGE_PREFIX = 'firmshake-prefs:';

export interface StoredGeoFilterPrefs {
  enabled?: boolean;
  radiusMiles?: number;
  label?: string;
  lat?: number;
  lng?: number;
}

export interface GeoFilterState {
  enabled: boolean;
  lat: number | null;
  lng: number | null;
  radiusMiles: number;
  label: string;
}

export function defaultGeoFilterState(): GeoFilterState {
  return {
    enabled: false,
    lat: null,
    lng: null,
    radiusMiles: DEFAULT_RADIUS_MILES,
    label: '',
  };
}

function prefsStorageKey(uid: string): string {
  return `${STORAGE_PREFIX}${buildUserCacheKey(uid, 'browse-geo-filter')}`;
}

export function loadGeoFilterPrefs(uid: string): StoredGeoFilterPrefs | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(prefsStorageKey(uid));
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as StoredGeoFilterPrefs;
  } catch {
    return null;
  }
}

export function saveGeoFilterPrefs(uid: string, state: GeoFilterState): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  const prefs: StoredGeoFilterPrefs = {
    enabled: state.enabled,
    radiusMiles: state.radiusMiles,
    label: state.label || undefined,
    lat: state.lat ?? undefined,
    lng: state.lng ?? undefined,
  };

  try {
    sessionStorage.setItem(prefsStorageKey(uid), JSON.stringify(prefs));
  } catch {
    // Ignore quota errors.
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
    enabled: prefs.enabled ?? base.enabled,
    lat: prefs.lat ?? base.lat,
    lng: prefs.lng ?? base.lng,
    radiusMiles: clampRadiusMiles(prefs.radiusMiles ?? base.radiusMiles),
    label: prefs.label ?? base.label,
  };
}
