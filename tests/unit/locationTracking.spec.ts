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
  let getCurrentPosition: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });

    getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition,
      },
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

  it('maps timeout geolocation errors to a retry message', () => {
    const message = getGeolocationErrorMessage({ code: 3, message: 'Timeout expired' });
    expect(message).toContain('timed out');
  });

  it('maps message-only geolocation failures', () => {
    const message = getGeolocationErrorMessage({
      name: 'GeolocationPositionError',
      message: 'User denied Geolocation',
    });
    expect(message).toContain('browser settings');
  });

  it('maps Capacitor unavailable plugin errors', () => {
    const message = getGeolocationErrorMessage({
      code: 'UNAVAILABLE',
      message: 'Location services are not available',
    });
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

    await expect(getCurrentCoordinates()).rejects.toBeInstanceOf(GeolocationAccessError);
    await expect(getCurrentCoordinates()).rejects.toMatchObject({
      reason: 'insecure',
    });
  });

  it('requests current position on web via navigator.geolocation', async () => {
    getCurrentPosition.mockImplementation((_success, _error, options) => {
      expect(options).toMatchObject({
        enableHighAccuracy: false,
        timeout: 15_000,
        maximumAge: 300_000,
      });
      _success({
        coords: {
          latitude: 37.77,
          longitude: -122.42,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          speed: null,
          heading: null,
        },
        timestamp: Date.now(),
      });
    });

    await expect(getCurrentCoordinates()).resolves.toEqual({
      lat: 37.77,
      lng: -122.42,
    });

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('retries with a fresh high-accuracy fix after a timeout', async () => {
    getCurrentPosition
      .mockImplementationOnce((_success, error, options) => {
        expect(options).toMatchObject({
          enableHighAccuracy: false,
          maximumAge: 300_000,
        });
        error({ code: 3, message: 'Timeout expired' });
      })
      .mockImplementationOnce((_success, _error, options) => {
        expect(options).toMatchObject({
          enableHighAccuracy: true,
          maximumAge: 0,
        });
        _success({
          coords: {
            latitude: 38.75,
            longitude: -77.47,
            accuracy: 12,
            altitude: null,
            altitudeAccuracy: null,
            speed: null,
            heading: null,
          },
          timestamp: Date.now(),
        });
      });

    await expect(getCurrentCoordinates()).resolves.toEqual({
      lat: 38.75,
      lng: -77.47,
    });

    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
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
