import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GeolocationAccessError,
  getCurrentCoordinates,
  getGeolocationErrorMessage,
  queryGeolocationPermissionState,
} from '@/common/services/locationTracking';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    requestPermissions: vi.fn(),
    getCurrentPosition: vi.fn(),
  },
}));

vi.mock('@/common/services/api', () => ({
  postMeetupLocation: vi.fn(),
}));

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

describe('locationTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });
  });

  it('maps permission denied geolocation errors to a settings message', () => {
    const message = getGeolocationErrorMessage({ code: 1, message: 'denied' });
    expect(message).toContain('browser settings');
  });

  it('maps unavailable geolocation errors to a device services message', () => {
    const message = getGeolocationErrorMessage({ code: 2, message: 'unavailable' });
    expect(message).toContain('location services');
  });

  it('rejects when geolocation is unavailable in the browser', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    });

    await expect(getCurrentCoordinates()).rejects.toMatchObject({
      reason: 'unsupported',
    });
  });

  it('rejects on insecure contexts before requesting location', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: false,
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn(),
      },
    });

    await expect(getCurrentCoordinates()).rejects.toBeInstanceOf(GeolocationAccessError);
    await expect(getCurrentCoordinates()).rejects.toMatchObject({
      reason: 'insecure',
    });
  });

  it('requests current position on web without preflight permission checks', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn(),
      },
    });
    vi.mocked(Geolocation.getCurrentPosition).mockResolvedValue({
      timestamp: Date.now(),
      coords: {
        latitude: 37.77,
        longitude: -122.42,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        speed: null,
        heading: null,
      },
    });

    await expect(getCurrentCoordinates()).resolves.toEqual({
      lat: 37.77,
      lng: -122.42,
    });

    expect(Geolocation.getCurrentPosition).toHaveBeenCalledWith({
      enableHighAccuracy: false,
      timeout: 15_000,
      maximumAge: 0,
    });
  });

  it('reads permission state when the Permissions API is available', async () => {
    const query = vi.fn().mockResolvedValue({ state: 'prompt' });
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query },
    });

    await expect(queryGeolocationPermissionState()).resolves.toBe('prompt');
    expect(query).toHaveBeenCalledWith({ name: 'geolocation' });
  });
});
