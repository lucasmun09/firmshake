/** In dev, route image/API URLs through the Vite proxy (same origin as the app). */
export function normalizeImageUrl(url: string): string {
  if (!url || !import.meta.env.DEV) return url;
  return url.replace(/^https?:\/\/(?:127\.0\.0\.1|localhost):5001(?=\/|$)/, '');
}

function devApiBaseUrl(): string {
  // Same-origin in dev; vite.config.ts proxies /api and /health to firmshake-api.
  return '';
}

function prodApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:5001';
}

export function getApiBaseUrl(): string {
  return import.meta.env.DEV ? devApiBaseUrl() : prodApiBaseUrl();
}
