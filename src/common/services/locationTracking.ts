import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

import { postMeetupLocation } from '@/common/services/api';

const POLL_INTERVAL_MS = 60_000;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let activeAgreementId: string | null = null;

function getBrowserPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 0,
    });
  });
}

async function getDevicePosition(): Promise<{ lat: number; lng: number }> {
  if (Capacitor.isNativePlatform()) {
    const permission = await Geolocation.requestPermissions();
    if (permission.location === 'denied') {
      throw new Error('Location permission is required');
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15_000,
    });

    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
  }

  const position = await getBrowserPosition();
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
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
