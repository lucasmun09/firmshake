import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

import { postMeetupLocation } from '@/common/services/api';

const POLL_INTERVAL_MS = 60_000;
const POSITION_TIMEOUT_MS = 15_000;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let activeAgreementId: string | null = null;

export type GeolocationFailureReason =
  | 'unsupported'
  | 'insecure'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'unknown';

export class GeolocationAccessError extends Error {
  readonly reason: GeolocationFailureReason;

  constructor(reason: GeolocationFailureReason, message: string) {
    super(message);
    this.name = 'GeolocationAccessError';
    this.reason = reason;
  }
}

export type GeolocationPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export function getGeolocationErrorMessage(error: unknown): string {
  if (error instanceof GeolocationAccessError) {
    return error.message;
  }

  const mapped = mapNativeGeolocationError(error);
  if (mapped) {
    return mapped.message;
  }

  return "Couldn't access your location. Search an address below.";
}

export async function queryGeolocationPermissionState(): Promise<GeolocationPermissionState> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unknown';
  }

  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
      return status.state;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function assertWebGeolocationAvailable(): void {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw new GeolocationAccessError(
      'insecure',
      'Location requires a secure (HTTPS) connection.',
    );
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new GeolocationAccessError(
      'unsupported',
      "Your browser doesn't support location access. Search an address below.",
    );
  }
}

function mapNativeGeolocationError(error: unknown): GeolocationAccessError | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const code = 'code' in error ? Number((error as { code?: unknown }).code) : NaN;
  if (!Number.isFinite(code)) {
    return null;
  }

  switch (code) {
    case 1:
      return new GeolocationAccessError(
        'denied',
        'Location access is blocked. Enable location for this site in your browser settings, then try again.',
      );
    case 2:
      return new GeolocationAccessError(
        'unavailable',
        "Couldn't determine your location. Check that location services are enabled on your device, or search an address below.",
      );
    case 3:
      return new GeolocationAccessError(
        'timeout',
        'Location request timed out. Try again or search an address below.',
      );
    default:
      return null;
  }
}

function toGeolocationAccessError(error: unknown): GeolocationAccessError {
  const mapped = mapNativeGeolocationError(error);
  if (mapped) {
    return mapped;
  }

  if (error instanceof GeolocationAccessError) {
    return error;
  }

  return new GeolocationAccessError(
    'unknown',
    "Couldn't access your location. Search an address below.",
  );
}

async function readCurrentPosition(): Promise<{ lat: number; lng: number }> {
  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: POSITION_TIMEOUT_MS,
      maximumAge: 0,
    });

    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
  } catch (error) {
    throw toGeolocationAccessError(error);
  }
}

async function getDevicePosition(): Promise<{ lat: number; lng: number }> {
  if (Capacitor.isNativePlatform()) {
    const permission = await Geolocation.requestPermissions();
    if (permission.location === 'denied') {
      throw new GeolocationAccessError(
        'denied',
        'Location permission is required. Enable it in your device settings, then try again.',
      );
    }

    return readCurrentPosition();
  }

  assertWebGeolocationAvailable();
  return readCurrentPosition();
}

async function sendCurrentLocation(agreementId: string): Promise<void> {
  const coords = await getDevicePosition();
  await postMeetupLocation(agreementId, coords.lat, coords.lng);
}

export async function startMeetupLocationPolling(agreementId: string): Promise<void> {
  await stopMeetupLocationPolling();

  activeAgreementId = agreementId;

  await sendCurrentLocation(agreementId);

  pollTimer = setInterval(() => {
    if (!activeAgreementId) {
      return;
    }

    sendCurrentLocation(activeAgreementId).catch(() => {
      // Keep polling even if one update fails.
    });
  }, POLL_INTERVAL_MS);
}

export async function stopMeetupLocationPolling(): Promise<void> {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  activeAgreementId = null;
}

export function isMeetupLocationPolling(): boolean {
  return pollTimer !== null;
}

export async function getCurrentCoordinates(): Promise<{ lat: number; lng: number }> {
  return getDevicePosition();
}
