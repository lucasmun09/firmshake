import { isApiConfigured } from '@/utils/apiBaseUrl';

function parseEnvFlag(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }
  return undefined;
}

/**
 * Listing create/update/remove via firmshake-api (`/api/v1/listings`).
 *
 * Default when `VITE_USE_BFF_LISTINGS` is unset:
 * - **Local dev (`import.meta.env.DEV`):** enabled when the API is reachable (Vite proxy or
 *   `VITE_API_BASE_URL`), so engineers exercise the BFF path without extra env.
 * - **Production builds:** disabled until explicitly opted in with `VITE_USE_BFF_LISTINGS=true`.
 *
 * Explicit `true`/`false` always wins; `true` still requires `isApiConfigured()`.
 */
export function useBffListings(): boolean {
  const explicit = parseEnvFlag(import.meta.env.VITE_USE_BFF_LISTINGS);
  if (explicit === true) {
    return isApiConfigured();
  }
  if (explicit === false) {
    return false;
  }
  return import.meta.env.DEV && isApiConfigured();
}

/**
 * Send listing messages via firmshake-api (`POST /api/v1/listings/{id}/messages`).
 *
 * Default: **false** — Phase 2 is not implemented; Firestore writes remain canonical.
 */
export function useBffMessages(): boolean {
  const explicit = parseEnvFlag(import.meta.env.VITE_USE_BFF_MESSAGES);
  if (explicit === true) {
    return isApiConfigured();
  }
  if (explicit === false) {
    return false;
  }
  return false;
}

/**
 * FirmShake agreement mutations via firmshake-api (`/api/v1/agreements`).
 *
 * Default when `VITE_USE_BFF_AGREEMENTS` is unset:
 * - **Local dev (`import.meta.env.DEV`):** enabled when the API is reachable.
 * - **Production builds:** disabled until explicitly opted in.
 */
export function useBffAgreements(): boolean {
  const explicit = parseEnvFlag(import.meta.env.VITE_USE_BFF_AGREEMENTS);
  if (explicit === true) {
    return isApiConfigured();
  }
  if (explicit === false) {
    return false;
  }
  return import.meta.env.DEV && isApiConfigured();
}

/**
 * Profile, blocks, communities, and moderation mutations via firmshake-api (`/api/v1/users`, etc.).
 *
 * Default when `VITE_USE_BFF_USERS` is unset:
 * - **Local dev:** enabled when the API is reachable (same as listings BFF).
 * - **Production builds:** disabled until explicitly opted in.
 */
export function useBffUsers(): boolean {
  const explicit = parseEnvFlag(import.meta.env.VITE_USE_BFF_USERS);
  if (explicit === true) {
    return isApiConfigured();
  }
  if (explicit === false) {
    return false;
  }
  return import.meta.env.DEV && isApiConfigured();
}

/**
 * Inbox thread fetch and inboxState mutations via firmshake-api (`/api/v1/inbox`).
 *
 * Default: **false** — Firestore listeners and direct inboxState writes remain canonical
 * until Phase 5 read migration is explicitly opted in.
 */
export function useBffInbox(): boolean {
  const explicit = parseEnvFlag(import.meta.env.VITE_USE_BFF_INBOX);
  if (explicit === true) {
    return isApiConfigured();
  }
  if (explicit === false) {
    return false;
  }
  return false;
}

/**
 * Browse search and categories via firmshake-api (`POST /api/v1/browse/search`,
 * `GET /api/v1/categories`).
 *
 * Default when `VITE_USE_BFF_BROWSE` is unset:
 * - **Enabled** when the API is configured (local dev proxy or `VITE_API_BASE_URL`).
 * - Explicit `false` disables BFF browse and falls back to Firestore feed + legacy search.
 */
export function useBffBrowse(): boolean {
  const explicit = parseEnvFlag(import.meta.env.VITE_USE_BFF_BROWSE);
  if (explicit === true) {
    return isApiConfigured();
  }
  if (explicit === false) {
    return false;
  }
  return isApiConfigured();
}
