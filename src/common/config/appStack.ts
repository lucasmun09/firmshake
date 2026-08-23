export type AppStack = 'devo' | 'prod' | 'unknown';

const DEVO_PROJECT_IDS = new Set(['firmshake-dev']);
const PROD_PROJECT_IDS = new Set(['firmshake-prod']);

function parseExplicitStack(value: string | undefined): AppStack | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'devo' || normalized === 'dev' || normalized === 'staging') {
    return 'devo';
  }
  if (normalized === 'prod' || normalized === 'production') {
    return 'prod';
  }
  return null;
}

/**
 * Resolve which FirmShake stack this build targets.
 *
 * Priority:
 * 1. Explicit `VITE_APP_STACK` (`devo` | `prod`)
 * 2. `VITE_FIREBASE_PROJECT_ID` (`firmshake-dev` → deovo, `firmshake-prod` → prod)
 * 3. Vite `DEV` → deovo (local engineers)
 * 4. `unknown` (fail closed for debug UI)
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

/** Devo-only debug chrome (banner, SMS bypass, mock balance). Never on prod. */
export function isDevoDebugUiEnabled(options?: {
  explicitStack?: string;
  projectId?: string;
  isDev?: boolean;
}): boolean {
  return isDevoStack(options);
}

/**
 * Persist debug logs to device localStorage on deovo/local only.
 * Prod keeps an in-memory ring for the session but does not write storage.
 */
export function shouldPersistDebugLogs(options?: {
  explicitStack?: string;
  projectId?: string;
  isDev?: boolean;
}): boolean {
  return isDevoStack(options);
}
