import type { User } from 'firebase/auth';

import { debugLog, serializeError } from '@/common/debug/debugLog';
import { clearIdTokenCache, getDedupedIdToken } from '@/common/services/idToken';
import { auth } from '@/common/services/firebase';
import { getAuthErrorCode } from '@/features/auth/utils/authErrors';

export const SESSION_EXTENDED_AT_KEY = 'firmshake:sessionExtendedAt';
export const SESSION_METADATA_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_ACTIVITY_EXTENSION_MS = 14 * 24 * 60 * 60 * 1000;
export const PROACTIVE_TOKEN_REFRESH_MS = 12 * 60 * 60 * 1000;
const RECOVERABILITY_CACHE_MS = 10_000;

let lastRecoverabilityCheck: { at: number; recoverable: boolean } | null = null;

export const SESSION_EXPIRED_QUERY = 'sessionExpired';
export const SESSION_EXPIRED_MESSAGE = 'Your session expired. Please sign in again.';

export class SessionExpiredError extends Error {
  readonly code = 'session-expired';

  constructor(message = SESSION_EXPIRED_MESSAGE) {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

let lastTokenRefreshAt = 0;
let sessionExpiryInProgress = false;
let sessionMaintenanceInitialized = false;

export function isSessionExpiredError(error: unknown): boolean {
  return error instanceof SessionExpiredError
    || (typeof error === 'object'
      && error !== null
      && 'code' in error
      && (error as { code: unknown }).code === 'session-expired');
}

export function isFirestorePermissionDenied(error: unknown): boolean {
  return getAuthErrorCode(error) === 'permission-denied';
}

function readSessionExtendedAt(): number | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  const raw = localStorage.getItem(SESSION_EXTENDED_AT_KEY);
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function touchSessionMetadata(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  const now = Date.now();
  const previous = readSessionExtendedAt();
  const extendedUntil = Math.max(
    now + SESSION_ACTIVITY_EXTENSION_MS,
    (previous ?? 0) + SESSION_ACTIVITY_EXTENSION_MS,
    now + SESSION_METADATA_TTL_MS,
  );

  localStorage.setItem(SESSION_EXTENDED_AT_KEY, String(extendedUntil));
}

export function clearSessionMetadata(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(SESSION_EXTENDED_AT_KEY);
  }
  lastTokenRefreshAt = 0;
  lastRecoverabilityCheck = null;
  clearIdTokenCache();
}

export function extendSessionOnLogin(): void {
  touchSessionMetadata();
  lastTokenRefreshAt = Date.now();
}

async function refreshAuthToken(user: User): Promise<void> {
  await getDedupedIdToken(user, true);
  lastTokenRefreshAt = Date.now();
  touchSessionMetadata();
}

const UNRECOVERABLE_AUTH_CODES = new Set([
  'auth/user-token-expired',
  'auth/invalid-user-token',
  'auth/user-disabled',
  'auth/user-not-found',
  'auth/invalid-credential',
]);

export async function isAuthSessionRecoverable(user?: User | null): Promise<boolean> {
  if (!auth) {
    return false;
  }

  if (
    lastRecoverabilityCheck
    && Date.now() - lastRecoverabilityCheck.at < RECOVERABILITY_CACHE_MS
  ) {
    return lastRecoverabilityCheck.recoverable;
  }

  await auth.authStateReady();

  const activeUser = user ?? auth.currentUser;
  if (!activeUser) {
    lastRecoverabilityCheck = { at: Date.now(), recoverable: false };
    return false;
  }

  try {
    await getDedupedIdToken(activeUser, false);
    lastRecoverabilityCheck = { at: Date.now(), recoverable: true };
    return true;
  } catch (err) {
    const code = getAuthErrorCode(err);
    if (code === 'auth/network-request-failed') {
      lastRecoverabilityCheck = { at: Date.now(), recoverable: true };
      return true;
    }

    if (code && UNRECOVERABLE_AUTH_CODES.has(code)) {
      lastRecoverabilityCheck = { at: Date.now(), recoverable: false };
      return false;
    }

    if (err instanceof Error && err.message.includes('token-refresh-timeout')) {
      const recoverable = Boolean(auth.currentUser);
      lastRecoverabilityCheck = { at: Date.now(), recoverable };
      return recoverable;
    }

    try {
      await refreshAuthToken(activeUser);
      lastRecoverabilityCheck = { at: Date.now(), recoverable: true };
      return true;
    } catch (refreshErr) {
      const refreshCode = getAuthErrorCode(refreshErr);
      if (refreshCode && UNRECOVERABLE_AUTH_CODES.has(refreshCode)) {
        lastRecoverabilityCheck = { at: Date.now(), recoverable: false };
        return false;
      }

      if (refreshErr instanceof Error && refreshErr.message.includes('token-refresh-timeout')) {
        const recoverable = Boolean(auth.currentUser);
        lastRecoverabilityCheck = { at: Date.now(), recoverable };
        return recoverable;
      }

      try {
        await activeUser.reload();
        const recoverable = Boolean(auth.currentUser);
        lastRecoverabilityCheck = { at: Date.now(), recoverable };
        return recoverable;
      } catch (reloadErr) {
        debugLog.warn('auth', 'Session recoverability check failed', {
          uid: activeUser.uid,
          error: serializeError(reloadErr),
          errorCode: getAuthErrorCode(reloadErr),
        });
        lastRecoverabilityCheck = { at: Date.now(), recoverable: false };
        return false;
      }
    }
  }
}

export async function handleUnrecoverableSession(
  reason: string,
  error?: unknown,
): Promise<never> {
  if (sessionExpiryInProgress) {
    throw new SessionExpiredError();
  }

  sessionExpiryInProgress = true;

  debugLog.warn('auth', 'Session expired; signing out and redirecting to login', {
    reason,
    error: error ? serializeError(error) : undefined,
    routePath: typeof window !== 'undefined' ? window.location.pathname : undefined,
  });

  clearSessionMetadata();

  try {
    const { logout } = await import('@/features/auth/services/auth');
    await logout();
  } catch (signOutErr) {
    debugLog.error('auth', 'Sign out during session expiry failed', {
      error: serializeError(signOutErr),
    });
  }

  const onLoginPage = typeof window !== 'undefined'
    && window.location.pathname === '/login';

  if (!onLoginPage) {
    try {
      const { default: router } = await import('@/router');
      await router.replace({
        name: 'Login',
        query: { [SESSION_EXPIRED_QUERY]: '1' },
      });
    } catch (navErr) {
      debugLog.error('auth', 'Session expiry redirect failed', {
        error: serializeError(navErr),
      });
      if (typeof window !== 'undefined') {
        window.location.assign(`/login?${SESSION_EXPIRED_QUERY}=1`);
      }
    }
  }

  throw new SessionExpiredError();
}

/**
 * Returns true when the error was handled (session expired redirect started).
 * Returns false when the caller may retry or surface the error.
 */
export async function handleFirestorePermissionDenied(
  error: unknown,
  context: string,
): Promise<boolean> {
  if (!isFirestorePermissionDenied(error)) {
    return false;
  }

  if (!auth?.currentUser) {
    debugLog.debug('auth', 'Firestore permission-denied ignored for guest', {
      context,
      error: serializeError(error),
    });
    return false;
  }

  if (auth?.currentUser) {
    const { shouldBypassPostAuthGuard } = await import('@/features/auth/services/auth');
    if (shouldBypassPostAuthGuard(auth.currentUser.uid)) {
      debugLog.debug('auth', 'Firestore permission-denied ignored during post-auth bypass', {
        context,
        uid: auth.currentUser.uid,
        error: serializeError(error),
      });
      return false;
    }
  }

  const recoverable = await isAuthSessionRecoverable();
  if (recoverable) {
    debugLog.debug('auth', 'Firestore permission-denied may be transient', {
      context,
      error: serializeError(error),
    });
    return false;
  }

  await handleUnrecoverableSession(context, error);
  return true;
}

export function createFirestoreSnapshotErrorHandler(
  onError?: (error: Error) => void,
  context = 'firestore-snapshot',
): (error: Error) => void {
  return (error: Error) => {
    if (!isFirestorePermissionDenied(error)) {
      onError?.(error);
      return;
    }

    void handleFirestorePermissionDenied(error, context).then((handled) => {
      if (!handled) {
        onError?.(error);
      }
    });
  };
}

export async function proactiveRefreshSessionToken(): Promise<void> {
  if (!auth?.currentUser) {
    return;
  }

  const now = Date.now();
  if (now - lastTokenRefreshAt < PROACTIVE_TOKEN_REFRESH_MS) {
    return;
  }

  try {
    await refreshAuthToken(auth.currentUser);
    debugLog.debug('auth', 'Proactive auth token refresh succeeded', {
      uid: auth.currentUser.uid,
    });
  } catch (err) {
    debugLog.warn('auth', 'Proactive auth token refresh failed', {
      uid: auth.currentUser.uid,
      error: serializeError(err),
      errorCode: getAuthErrorCode(err),
    });
  }
}

export function initProactiveSessionMaintenance(): void {
  if (sessionMaintenanceInitialized || typeof window === 'undefined') {
    return;
  }

  sessionMaintenanceInitialized = true;

  const onActivity = () => {
    if (auth?.currentUser) {
      touchSessionMetadata();
    }
  };

  const onFocus = () => {
    void proactiveRefreshSessionToken();
    onActivity();
  };

  window.addEventListener('focus', onFocus);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      onFocus();
    }
  });
  window.addEventListener('pointerdown', onActivity, { passive: true });
  window.addEventListener('keydown', onActivity, { passive: true });
}
