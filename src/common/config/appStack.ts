import {
  DEVO_PROJECT_IDS,
  PROD_PROJECT_IDS,
  isProdPublicHostnameValue,
  normalizeHostname,
} from '@/common/config/stackHosts';

export type AppStack = 'devo' | 'prod' | 'unknown';

export {
  DEVO_FIREBASE_PROJECT_ID,
  PROD_FIREBASE_PROJECT_ID,
  DEVO_HOSTING_HOSTNAMES,
  PROD_HOSTING_HOSTNAMES,
  PROD_PUBLIC_HOSTNAMES,
  CONTROLPANEL_HOSTING_ORIGIN,
  DEVO_API_HOST_MARKER,
} from '@/common/config/stackHosts';

function parseExplicitStack(value: string | undefined): AppStack | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'devo' || normalized === 'deovo' || normalized === 'dev' || normalized === 'staging') {
    return 'devo';
  }
  if (normalized === 'prod' || normalized === 'production') {
    return 'prod';
  }
  return null;
}

/**
 * True when the page is served on a production public hostname.
 * Used to hide DEVO tools on firm-shake.com while custom domain still
 * points at firmshake-dev Hosting.
 */
export function isProdPublicHostname(options?: { hostname?: string }): boolean {
  const hostname =
    options?.hostname ??
    (typeof window !== 'undefined' ? window.location.hostname : undefined);
  return isProdPublicHostnameValue(hostname);
}

/**
 * Resolve which FirmShake stack this build targets.
 *
 * Priority:
 * 1. Explicit `VITE_APP_STACK` (`devo` | `prod`)
 * 2. `VITE_FIREBASE_PROJECT_ID` (`firmshake-dev` → deovo, `firmshake-prod` → prod)
 * 3. Vite `DEV` → deovo (local engineers)
 * 4. `unknown` (fail closed for debug UI)
 *
 * Note: build/stack identity does not consider hostname. Use
 * `isDevoDebugUiEnabled` / `shouldPersistDebugLogs` for UI surfaces that
 * must stay hidden on production custom domains.
 */
export function resolveAppStack(options?: {
  explicitStack?: string;
  projectId?: string;
  isDev?: boolean;
}): AppStack {
  const explicit = parseExplicitStack(
    options?.explicitStack ?? (import.meta.env.VITE_APP_STACK as string | undefined),
  );
  if (explicit) {
    return explicit;
  }

  const projectId = (
    options?.projectId ?? (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ?? ''
  ).trim();

  if (DEVO_PROJECT_IDS.has(projectId)) {
    return 'devo';
  }
  if (PROD_PROJECT_IDS.has(projectId)) {
    return 'prod';
  }

  const isDev = options?.isDev ?? Boolean(import.meta.env.DEV);
  if (isDev) {
    return 'devo';
  }

  return 'unknown';
}

/** True when this build is the firmshake-dev / local deovo stack. */
export function isDevoStack(options?: {
  explicitStack?: string;
  projectId?: string;
  isDev?: boolean;
}): boolean {
  return resolveAppStack(options) === 'devo';
}

export type DevoDebugUiOptions = {
  explicitStack?: string;
  projectId?: string;
  isDev?: boolean;
  hostname?: string;
};

/**
 * Devo-only debug chrome (banner, SMS bypass, mock balance).
 * Never on prod builds, and never on production public hostnames
 * (`firm-shake.com` / `www`) even if backend project is still firmshake-dev.
 */
export function isDevoDebugUiEnabled(options?: DevoDebugUiOptions): boolean {
  if (isProdPublicHostname(options)) {
    return false;
  }
  return isDevoStack(options);
}

/**
 * Persist debug logs to device localStorage on deovo/local only.
 * Prod builds and production public hostnames keep an in-memory ring only.
 */
export function shouldPersistDebugLogs(options?: DevoDebugUiOptions): boolean {
  if (isProdPublicHostname(options)) {
    return false;
  }
  return isDevoStack(options);
}

/** Re-export for callers that only need hostname normalize. */
export { normalizeHostname };
