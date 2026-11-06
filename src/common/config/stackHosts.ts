/**
 * Dual-stack host / project identity constants.
 * Kept separate from resolve logic so parallel agents can edit hosts vs resolution.
 * See docs/devo-prod-stacks.md.
 */

export const DEVO_FIREBASE_PROJECT_ID = 'firmshake-dev';
export const PROD_FIREBASE_PROJECT_ID = 'firmshake-prod';

export const DEVO_PROJECT_IDS = new Set([DEVO_FIREBASE_PROJECT_ID]);
export const PROD_PROJECT_IDS = new Set([PROD_FIREBASE_PROJECT_ID]);

/** Firebase Hosting default sites for each stack. */
export const DEVO_HOSTING_HOSTNAMES = [
  'firmshake-dev.web.app',
  'firmshake-dev.firebaseapp.com',
] as const;

export const PROD_HOSTING_HOSTNAMES = [
  'firmshake-prod.web.app',
  'firmshake-prod.firebaseapp.com',
] as const;

/**
 * Public production custom domains. DEVO debug chrome must never show here,
 * even while Hosting still serves a firmshake-dev build (pre-cutover).
 */
export const PROD_PUBLIC_HOSTNAMES = new Set(['firm-shake.com', 'www.firm-shake.com']);

/** Control panel lives on deovo only — never wire into prod CORS. */
export const CONTROLPANEL_HOSTING_ORIGIN = 'https://firmshake-controlpanel.web.app';

/** Staging Cloud Run hostname fragment used by deploy assert guards. */
export const DEVO_API_HOST_MARKER = 'firmshake-api-staging';

export type AdminToolbarSite = {
  id: 'controlpanel' | 'controlpanel-local' | 'logs';
  label: string;
  href: string;
  /** Open in a new browsing context (external CP). */
  external: boolean;
};

/**
 * Admin-only toolbar destinations.
 * Controlpanel is always the hosted deovo site; local CP is DEV-only.
 * Logs is same-origin `/logs` (opens a new tab so IndexedDB leases stay isolated).
 */
export function resolveAdminToolbarSites(options?: {
  isDev?: boolean;
  origin?: string;
}): AdminToolbarSite[] {
  const isDev = options?.isDev ?? Boolean(import.meta.env.DEV);
  const origin =
    options?.origin ??
    (typeof window !== 'undefined' ? window.location.origin : '');

  const sites: AdminToolbarSite[] = [
    {
      id: 'controlpanel',
      label: 'Controlpanel',
      href: CONTROLPANEL_HOSTING_ORIGIN,
      external: true,
    },
    {
      id: 'logs',
      label: 'Logs',
      href: `${origin.replace(/\/$/, '')}/logs`,
      external: true,
    },
  ];

  if (isDev) {
    sites.splice(1, 0, {
      id: 'controlpanel-local',
      label: 'Local CP',
      href: 'http://localhost:5174',
      external: true,
    });
  }

  return sites;
}

export function normalizeHostname(hostname: string | undefined): string {
  return (hostname ?? '').trim().toLowerCase().replace(/\.$/, '');
}

export function isProdPublicHostnameValue(hostname: string | undefined): boolean {
  return PROD_PUBLIC_HOSTNAMES.has(normalizeHostname(hostname));
}
