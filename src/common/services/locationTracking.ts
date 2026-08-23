import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

import { postMeetupLocation } from '@/common/services/api';

const POLL_INTERVAL_MS = 60_000;
const POSITION_TIMEOUT_MS = 15_000;
/** Accept a recent cached fix on web when permission is already granted. */
const WEB_POSITION_MAX_AGE_MS = 300_000;

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

function geolocationErrorForCode(code: number): GeolocationAccessError | null {
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

function resolveGeolocationErrorCode(error: object): number | null {
  if ('code' in error) {
    const numericCode = Number((error as { code?: unknown }).code);
    if (Number.isFinite(numericCode) && numericCode >= 1 && numericCode <= 3) {
      return numericCode;
    }
  }

  const positionError = error as {
    PERMISSION_DENIED?: number;
    POSITION_UNAVAILABLE?: number;
    TIMEOUT?: number;
    code?: number;
  };

  if (
    positionError.code === positionError.PERMISSION_DENIED
    || positionError.code === 1
  ) {
    return 1;
  }
  if (
    positionError.code === positionError.POSITION_UNAVAILABLE
    || positionError.code === 2
  ) {
    return 2;
  }
  if (positionError.code === positionError.TIMEOUT || positionError.code === 3) {
    return 3;
  }

  return null;
}

function mapGeolocationErrorMessage(message: string): GeolocationAccessError | null {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (
    normalized.includes('permission denied')
    || normalized.includes('denied geolocation')
    || normalized.includes('user denied')
  ) {
    return geolocationErrorForCode(1);
  }

  if (
    normalized.includes('position unavailable')
    || normalized.includes('unavailable')
    || normalized.includes('location services')
    || normalized.includes('kcleerrordomain')
  ) {
    return geolocationErrorForCode(2);
  }

  if (normalized.includes('timeout') || normalized.includes('timed out')) {
    return geolocationErrorForCode(3);
  }

  return null;
}

function mapNativeGeolocationError(error: unknown): GeolocationAccessError | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const code = resolveGeolocationErrorCode(error);
  if (code != null) {
    return geolocationErrorForCode(code);
  }

  if ('name' in error && (error as { name?: unknown }).name === 'GeolocationPositionError') {
    return mapGeolocationErrorMessage(
      'message' in error ? String((error as { message?: unknown }).message ?? '') : '',
    );
  }

  if ('code' in error) {
    const pluginCode = String((error as { code?: unknown }).code);
    if (pluginCode === 'UNAVAILABLE') {
      return geolocationErrorForCode(2);
    }
    if (pluginCode === 'UNIMPLEMENTED') {
      return new GeolocationAccessError(
        'unsupported',
        "Your browser doesn't support location access. Search an address below.",
      );
    }
  }

  if ('message' in error) {
    const mapped = mapGeolocationErrorMessage(String((error as { message?: unknown }).message ?? ''));
    if (mapped) {
      return mapped;
    }
  }

  return null;
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

function readWebPosition(options: PositionOptions): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
      options,
    );
  });
}

async function readWebCurrentPosition(): Promise<{ lat: number; lng: number }> {
  assertWebGeolocationAvailable();

  const cachedOptions: PositionOptions = {
    enableHighAccuracy: false,
    timeout: POSITION_TIMEOUT_MS,
    maximumAge: WEB_POSITION_MAX_AGE_MS,
  };

  try {
    return await readWebPosition(cachedOptions);
  } catch (firstError) {
    const firstMapped = mapNativeGeolocationError(firstError);
    if (
      firstMapped?.reason !== 'timeout'
      && firstMapped?.reason !== 'unavailable'
    ) {
      throw toGeolocationAccessError(firstError);
    }

    try {
      return await readWebPosition({
        enableHighAccuracy: true,
        timeout: POSITION_TIMEOUT_MS,
        maximumAge: 0,
      });
    } catch (retryError) {
      throw toGeolocationAccessError(retryError);
    }
  }
}

async function readNativeCurrentPosition(): Promise<{ lat: number; lng: number }> {
  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: POSITION_TIMEOUT_MS,
      maximumAge: WEB_POSITION_MAX_AGE_MS,
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

    return readNativeCurrentPosition();
  }

  return readWebCurrentPosition();
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
