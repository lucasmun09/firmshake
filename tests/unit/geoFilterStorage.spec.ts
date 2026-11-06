import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearGeoFilterPrefs,
  clearGeoFilterPrefsIfUserChanged,
  defaultGeoFilterState,
  geoFilterPrefsStorageKey,
  hydrateGeoFilterFromPrefs,
  initGeoFilterStorageOnPageLoad,
  loadGeoFilterPrefs,
  parseCityRegionFromAddress,
  saveGeoFilterPrefs,
} from '@/features/listings/services/geoFilterStorage';

describe('geoFilterStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses localStorage key firmshake-prefs:browse-geo-filter:uid={uid}', () => {
    expect(geoFilterPrefsStorageKey('user-1')).toBe(
      'firmshake-prefs:browse-geo-filter:uid=user-1',
    );
  });

  it('returns default state when no prefs are stored', () => {
    expect(hydrateGeoFilterFromPrefs('user-1')).toEqual({
      enabled: true,
      lat: null,
      lng: null,
      radiusMiles: 10,
      label: '',
      city: '',
      region: '',
    });
    expect(loadGeoFilterPrefs('user-1')).toBeNull();
  });

  it('persists and restores lat, lng, label, city, region, and radiusMiles', () => {
    saveGeoFilterPrefs('user-1', {
      enabled: true,
      lat: 37.77,
      lng: -122.42,
      radiusMiles: 10,
      label: 'San Francisco, CA',
      city: 'San Francisco',
      region: 'CA',
    });

    expect(loadGeoFilterPrefs('user-1')).toMatchObject({
      lat: 37.77,
      lng: -122.42,
      radiusMiles: 10,
      label: 'San Francisco, CA',
      city: 'San Francisco',
      region: 'CA',
    });

    expect(hydrateGeoFilterFromPrefs('user-1')).toMatchObject({
      lat: 37.77,
      lng: -122.42,
      radiusMiles: 10,
      label: 'San Francisco, CA',
      city: 'San Francisco',
      region: 'CA',
    });
  });

  it('normalizes stored radius to supported dropdown options', () => {
    saveGeoFilterPrefs('user-1', {
      enabled: true,
      lat: 37.77,
      lng: -122.42,
      radiusMiles: 25,
      label: 'San Francisco, CA',
      city: 'San Francisco',
      region: 'CA',
    });

    expect(hydrateGeoFilterFromPrefs('user-1')).toMatchObject({
      radiusMiles: 20,
    });
  });

  it('skips redundant writes when prefs are unchanged', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    saveGeoFilterPrefs('user-1', {
      enabled: true,
      lat: 37.77,
      lng: -122.42,
      radiusMiles: 10,
      label: 'San Francisco, CA',
      city: 'San Francisco',
      region: 'CA',
    });

    setItemSpy.mockClear();

    saveGeoFilterPrefs('user-1', {
      enabled: true,
      lat: 37.77,
      lng: -122.42,
      radiusMiles: 10,
      label: 'San Francisco, CA',
      city: 'San Francisco',
      region: 'CA',
    });

    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });

  it('clears stored geo prefs when location is cleared', () => {
    saveGeoFilterPrefs('user-1', {
      enabled: true,
      lat: 37.77,
      lng: -122.42,
      radiusMiles: 10,
      label: 'San Francisco, CA',
      city: 'San Francisco',
      region: 'CA',
    });

    saveGeoFilterPrefs('user-1', defaultGeoFilterState());

    expect(loadGeoFilterPrefs('user-1')).toBeNull();
    expect(hydrateGeoFilterFromPrefs('user-1')).toEqual(defaultGeoFilterState());
  });

  it('clears previous owner prefs on user switch', () => {
    initGeoFilterStorageOnPageLoad();
    saveGeoFilterPrefs('anonymous', {
      enabled: true,
      lat: 40.71,
      lng: -74.01,
      radiusMiles: 10,
      label: 'New York, NY',
      city: 'New York',
      region: 'NY',
    });

    clearGeoFilterPrefsIfUserChanged('user-1');

    expect(loadGeoFilterPrefs('anonymous')).toBeNull();
    expect(hydrateGeoFilterFromPrefs('user-1')).toEqual(defaultGeoFilterState());
  });

  it('parses city and region from comma-separated addresses', () => {
    expect(parseCityRegionFromAddress('123 Main St, San Francisco, CA, USA')).toEqual({
      city: 'San Francisco',
      region: 'CA',
    });
  });
});
