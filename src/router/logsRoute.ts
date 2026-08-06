/** True on first paint when this tab should use the minimal logs-only boot (no Firebase). */
export function isLogsInitialPath(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.pathname === '/logs'
    || window.location.hash.includes('/logs');
}

/** Minimal route shape for logs exemption checks (router guard, post-auth nav). */
export interface LogsRouteLike {
  name?: string | symbol | null;
  path: string;
}

/** True only for the debug /logs route — not other skipAuthFlow routes (e.g. Profile). */
export function isLogsRoute(route: LogsRouteLike): boolean {
  return route.name === 'Logs' || route.path === '/logs';
}

export interface AuthReadyBypassRouteLike extends LogsRouteLike {
  meta?: { public?: boolean };
}

/** Public debug/auth pages must not block on authReady before mount. */
export function shouldSkipAuthReadyWait(route: AuthReadyBypassRouteLike): boolean {
  return isLogsRoute(route) || route.meta?.public === true;
}
