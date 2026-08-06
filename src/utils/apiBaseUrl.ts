/** Cloud Run staging API — used when VITE_API_BASE_URL is unset in production builds. */
const DEFAULT_API_BASE_URL =
  'https://firmshake-api-staging-858269838319.us-central1.run.app';

function isLocalhostApiUrl(url: string): boolean {
  return /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(url);
}

function isBrowserOnLocalhost(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

function resolveApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    const configured = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';
    // Remote API in .env.local (e.g. staging) — call directly; skip Vite proxy.
    if (configured && !isLocalhostApiUrl(configured)) {
      return configured;
    }
    // Same-origin in dev; vite.config.ts proxies /api and /health to firmshake-api.
    return '';
  }

  const configured = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';
  const url = configured || DEFAULT_API_BASE_URL;

  // Never call a localhost API from a deployed site (CORS / unreachable).
  if (isLocalhostApiUrl(url) && !isBrowserOnLocalhost()) {
    return '';
  }

  return url;
}

/** True when API calls can be routed for this environment (proxy, remote, or deployed URL). */
export function isApiConfigured(): boolean {
  if (import.meta.env.DEV) {
    return true;
  }

  return Boolean(resolveApiBaseUrl());
}

/** User-facing hint when photo/API features are unavailable. */
export function getApiUnavailableMessage(): string {
  if (import.meta.env.DEV) {
    return 'Photo uploads need firmshake-api running locally (cd firmshake-api && python app.py).';
  }

  if (!isApiConfigured()) {
    return 'Photo uploads are unavailable — this build is missing VITE_API_BASE_URL for the deployed API.';
  }

  return 'Could not reach the FirmShake API. Try again in a moment.';
}

export function getApiBaseUrl(): string {
  return resolveApiBaseUrl();
}

/** In dev, route image/API URLs through the Vite proxy (same origin as the app). */
export function normalizeImageUrl(url: string): string {
  if (!url) {
    return url;
  }

  if (import.meta.env.DEV) {
    return url.replace(/^https?:\/\/(?:127\.0\.0\.1|localhost):5001(?=\/|$)/, '');
  }

  const apiBase = resolveApiBaseUrl();
  if (apiBase) {
    return url.replace(/^https?:\/\/(?:127\.0\.0\.1|localhost):5001(?=\/|$)/, apiBase);
  }

  return url;
}
