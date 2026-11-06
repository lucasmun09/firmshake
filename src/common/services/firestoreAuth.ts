import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';

import { debugLog, serializeError } from '@/common/debug/debugLog';
import { clearIdTokenCache, getDedupedIdToken } from '@/common/services/idToken';
import {
  handleFirestorePermissionDenied,
  handleUnrecoverableSession,
  isFirestorePermissionDenied,
  isSessionExpiredError,
  SessionExpiredError,
} from '@/features/auth/services/sessionExpiry';
import { auth, db } from '@/common/services/firebase';

const FIRESTORE_AUTH_MAX_ATTEMPTS = 5;
const PERMISSION_DENIED_PROPAGATION_RETRIES = 3;
const INITIAL_PROPAGATION_DELAY_MS = 150;
const FIRESTORE_PROBE_TIMEOUT_MS = 3000;
const FIRESTORE_AUTH_OVERALL_TIMEOUT_MS = 8000;
const AUTH_VERIFIED_TTL_MS = 30_000;
const TRANSIENT_RETRY_BASE_MS = 200;
const TRANSIENT_RETRY_MAX_ELAPSED_MS = 3000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isFirestoreWaitTimeout(error: unknown): boolean {
  return error instanceof Error && error.message.includes('timed out after');
}

let inFlightWait: Promise<User> | null = null;
let inFlightWaitUid: string | null = null;
let permissionDeniedPropagationAttempts = 0;
let lastVerifiedAuth: { uid: string; at: number } | null = null;

function propagationDelayMs(attempt: number): number {
  if (attempt === 0) {
    return INITIAL_PROPAGATION_DELAY_MS;
  }

  return 150 * (attempt + 1);
}

function markAuthVerified(uid: string): void {
  lastVerifiedAuth = { uid, at: Date.now() };
}

function getCachedVerifiedUser(user?: User | null): User | null {
  const uid = user?.uid ?? auth?.currentUser?.uid ?? null;
  if (!uid || !lastVerifiedAuth) {
    return null;
  }

  if (
    lastVerifiedAuth.uid === uid
    && Date.now() - lastVerifiedAuth.at < AUTH_VERIFIED_TTL_MS
  ) {
    return user ?? auth?.currentUser ?? null;
  }

  return null;
}

async function refreshIdTokenOnce(user: User, forceRefresh = false): Promise<void> {
  await getDedupedIdToken(user, forceRefresh);
}

export async function prepareFirestoreSession(user: User): Promise<void> {
  clearFirestoreAuthCache();
  await refreshIdTokenOnce(user, true);
}

async function probeFirestoreAuth(user: User | null | undefined): Promise<User> {
  if (!auth) {
    throw new Error('Firebase auth is not configured');
  }

  const started = Date.now();
  let lastError: unknown;
  permissionDeniedPropagationAttempts = 0;

  for (let attempt = 0; attempt < FIRESTORE_AUTH_MAX_ATTEMPTS; attempt += 1) {
    const elapsedMs = Date.now() - started;
    if (elapsedMs >= FIRESTORE_AUTH_OVERALL_TIMEOUT_MS) {
      if (lastError && isFirestorePermissionDenied(lastError)) {
        await handleFirestorePermissionDenied(lastError, 'waitForFirestoreAuth-timeout');
      }

      debugLog.warn('auth', 'waitForFirestoreAuth: overall timeout', {
        uid: (user ?? auth.currentUser)?.uid ?? null,
        attempt,
        elapsedMs,
        timeoutMs: FIRESTORE_AUTH_OVERALL_TIMEOUT_MS,
        lastError: lastError ? serializeError(lastError) : undefined,
      });
      throw lastError ?? new Error('Firestore authentication did not become ready');
    }

    debugLog.debug('auth', 'waitForFirestoreAuth: waiting for authStateReady', {
      passedUserUid: user?.uid ?? null,
      authCurrentUserUid: auth.currentUser?.uid ?? null,
      attempt,
      elapsedMs,
    });

    await auth.authStateReady();

    const activeUser = user ?? auth.currentUser;
    if (!activeUser) {
      debugLog.warn('auth', 'waitForFirestoreAuth: no signed-in user after authStateReady');
      throw new Error('You must be signed in');
    }

    const forceTokenRefresh = attempt > 0;
    try {
      await refreshIdTokenOnce(activeUser, forceTokenRefresh);
      debugLog.debug('auth', 'waitForFirestoreAuth: ID token ready', {
        uid: activeUser.uid,
        attempt,
        forceRefresh: forceTokenRefresh,
        elapsedMs: Date.now() - started,
      });
    } catch (err) {
      if (isSessionExpiredError(err)) {
        throw err;
      }

      if (isFirestoreWaitTimeout(err)) {
        const handled = await handleFirestorePermissionDenied(err, 'waitForFirestoreAuth-getIdToken-timeout');
        if (handled) {
          throw new SessionExpiredError();
        }

        lastError = err;
        debugLog.warn('auth', 'waitForFirestoreAuth: getIdToken timed out; retrying', {
          uid: activeUser.uid,
          attempt,
          elapsedMs: Date.now() - started,
        });
        continue;
      }

      const handled = await handleFirestorePermissionDenied(err, 'waitForFirestoreAuth-getIdToken');
      if (handled) {
        throw new SessionExpiredError();
      }

      debugLog.error('auth', 'waitForFirestoreAuth: getIdToken failed', {
        uid: activeUser.uid,
        attempt,
        error: serializeError(err),
      });
      throw err;
    }

    if (!db) {
      debugLog.debug('auth', 'waitForFirestoreAuth: complete (no db)', {
        uid: activeUser.uid,
        elapsedMs: Date.now() - started,
        attempt,
      });
      markAuthVerified(activeUser.uid);
      return activeUser;
    }

    await sleep(propagationDelayMs(attempt));

    try {
      await withTimeout(
        getDoc(doc(db, 'users', activeUser.uid)),
        FIRESTORE_PROBE_TIMEOUT_MS,
        'Firestore probe',
      );
      debugLog.debug('auth', 'waitForFirestoreAuth: Firestore access verified', {
        uid: activeUser.uid,
        attempt,
        elapsedMs: Date.now() - started,
      });
      markAuthVerified(activeUser.uid);
      return activeUser;
    } catch (err) {
      lastError = err;

      if (isSessionExpiredError(err)) {
        throw err;
      }

      const isPermissionDenied = isFirestorePermissionDenied(err);
      const isTimedOut = isFirestoreWaitTimeout(err);

      if (isPermissionDenied) {
        permissionDeniedPropagationAttempts += 1;

        if (permissionDeniedPropagationAttempts > PERMISSION_DENIED_PROPAGATION_RETRIES) {
          const handled = await handleFirestorePermissionDenied(err, 'waitForFirestoreAuth-probe');
          if (handled) {
            throw new SessionExpiredError();
          }
        }
      }

      const willRetry = (isPermissionDenied || isTimedOut)
        && attempt < FIRESTORE_AUTH_MAX_ATTEMPTS - 1;

      if (willRetry) {
        debugLog.debug('auth', 'waitForFirestoreAuth: retrying after probe failure', {
          uid: activeUser.uid,
          attempt,
          reason: isTimedOut ? 'timeout' : 'permission-denied',
        });
        continue;
      }

      if (isPermissionDenied) {
        const handled = await handleFirestorePermissionDenied(err, 'waitForFirestoreAuth-probe-final');
        if (handled) {
          throw new SessionExpiredError();
        }
      }

      debugLog.warn('auth', 'waitForFirestoreAuth: probe failed after retries', {
        uid: activeUser.uid,
        attempt,
        elapsedMs: Date.now() - started,
        error: serializeError(err),
      });
      throw err;
    }
  }

  if (lastError && isFirestorePermissionDenied(lastError)) {
    await handleUnrecoverableSession('waitForFirestoreAuth-exhausted', lastError);
  }

  throw lastError ?? new Error('Firestore authentication did not become ready');
}

export async function waitForFirestoreAuth(user?: User | null): Promise<User> {
  const cachedUser = getCachedVerifiedUser(user);
  if (cachedUser) {
    return cachedUser;
  }

  const uid = user?.uid ?? auth?.currentUser?.uid ?? null;
  if (inFlightWait && inFlightWaitUid === uid) {
    debugLog.debug('auth', 'waitForFirestoreAuth: reusing in-flight wait', { uid });
    return inFlightWait;
  }

  inFlightWaitUid = uid;
  inFlightWait = probeFirestoreAuth(user).finally(() => {
    if (inFlightWaitUid === uid) {
      inFlightWait = null;
      inFlightWaitUid = null;
    }
  });

  return inFlightWait;
}

/**
 * Fast path for router navigation: confirm Firebase session + ID token without
 * blocking on Firestore probe retries (those run in bootstrap / data fetches).
 */
export async function waitForFirestoreAuthNavigation(user?: User | null): Promise<User> {
  const cachedUser = getCachedVerifiedUser(user);
  if (cachedUser) {
    return cachedUser;
  }

  if (!auth) {
    throw new Error('Firebase auth is not configured');
  }

  await auth.authStateReady();

  const activeUser = user ?? auth.currentUser;
  if (!activeUser) {
    throw new Error('You must be signed in');
  }

  await getDedupedIdToken(activeUser, false);
  markAuthVerified(activeUser.uid);
  return activeUser;
}

export async function ensureFirestoreAuth(): Promise<void> {
  await waitForFirestoreAuth();
}

export function clearFirestoreAuthCache(): void {
  lastVerifiedAuth = null;
  inFlightWait = null;
  inFlightWaitUid = null;
  permissionDeniedPropagationAttempts = 0;
  clearIdTokenCache();
}

export { getDedupedIdToken } from '@/common/services/idToken';

export async function withFirestoreRetry<T>(
  operation: () => Promise<T>,
  user: User,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await waitForFirestoreAuth(user);
      return await operation();
    } catch (error) {
      lastError = error;

      if (isSessionExpiredError(error)) {
        throw error;
      }

      if (!isFirestorePermissionDenied(error) || attempt === maxAttempts - 1) {
        if (isFirestorePermissionDenied(error)) {
          const handled = await handleFirestorePermissionDenied(error, 'withFirestoreRetry');
          if (handled) {
            throw new SessionExpiredError();
          }
        }
        throw error;
      }

      const handled = await handleFirestorePermissionDenied(error, 'withFirestoreRetry-transient');
      if (handled) {
        throw new SessionExpiredError();
      }

      debugLog.debug('auth', 'withFirestoreRetry: permission-denied, retrying', {
        uid: user.uid,
        attempt,
      });

      clearFirestoreAuthCache();
      await refreshIdTokenOnce(user, attempt >= 1);
      await sleep(TRANSIENT_RETRY_BASE_MS * (attempt + 1));
    }
  }

  throw lastError;
}

async function withTransientPublicFirestoreRetry<T>(
  operation: () => Promise<T>,
  context: string,
  maxElapsedMs: number,
): Promise<T> {
  const started = Date.now();
  let attempt = 0;
  let lastError: unknown;

  while (Date.now() - started < maxElapsedMs) {
    try {
      if (auth) {
        await auth.authStateReady();
      }
      return await operation();
    } catch (error) {
      lastError = error;

      if (isSessionExpiredError(error)) {
        throw error;
      }

      if (!isFirestorePermissionDenied(error) && !isFirestoreWaitTimeout(error)) {
        throw error;
      }

      attempt += 1;
      debugLog.debug('auth', 'Transient Firestore retry (guest)', {
        context,
        attempt,
        elapsedMs: Date.now() - started,
      });

      await sleep(Math.min(TRANSIENT_RETRY_BASE_MS * attempt, 600));
    }
  }

  throw lastError ?? new Error('Firestore request failed');
}

/**
 * Retries transient permission-denied errors with backoff while auth propagates.
 * Shows loading UI upstream; only surfaces errors when the session is dead.
 * Guest/public reads skip auth wait and run the operation directly.
 */
export async function withTransientFirestoreRetry<T>(
  operation: () => Promise<T>,
  options: {
    user?: User | null;
    context?: string;
    maxElapsedMs?: number;
  } = {},
): Promise<T> {
  const context = options.context ?? 'transient-firestore-retry';
  const maxElapsedMs = options.maxElapsedMs ?? TRANSIENT_RETRY_MAX_ELAPSED_MS;
  const activeUser = options.user ?? auth?.currentUser;

  if (!activeUser) {
    return withTransientPublicFirestoreRetry(operation, context, maxElapsedMs);
  }

  const started = Date.now();
  let attempt = 0;
  let lastError: unknown;
  let forcedRefresh = false;

  while (Date.now() - started < maxElapsedMs) {
    try {
      await waitForFirestoreAuth(activeUser);
      return await operation();
    } catch (error) {
      lastError = error;

      if (isSessionExpiredError(error)) {
        throw error;
      }

      if (!isFirestorePermissionDenied(error) && !isFirestoreWaitTimeout(error)) {
        throw error;
      }

      const handled = await handleFirestorePermissionDenied(error, context);
      if (handled) {
        throw new SessionExpiredError();
      }

      attempt += 1;
      debugLog.debug('auth', 'Transient Firestore retry', {
        context,
        uid: activeUser.uid,
        attempt,
        elapsedMs: Date.now() - started,
      });

      clearFirestoreAuthCache();
      if (!forcedRefresh && Date.now() - started >= maxElapsedMs * 0.6) {
        forcedRefresh = true;
        await refreshIdTokenOnce(activeUser, true);
      }

      await sleep(Math.min(TRANSIENT_RETRY_BASE_MS * attempt, 600));
    }
  }

  if (!forcedRefresh) {
    try {
      clearFirestoreAuthCache();
      await refreshIdTokenOnce(activeUser, true);
      await waitForFirestoreAuth(activeUser);
      return await operation();
    } catch (error) {
      lastError = error;
      if (isSessionExpiredError(error)) {
        throw error;
      }

      const handled = await handleFirestorePermissionDenied(error, `${context}-force-refresh`);
      if (handled) {
        throw new SessionExpiredError();
      }

      if (!isFirestorePermissionDenied(error) && !isFirestoreWaitTimeout(error)) {
        throw error;
      }
    }
  }

  if (lastError && isFirestorePermissionDenied(lastError)) {
    const handled = await handleFirestorePermissionDenied(lastError, `${context}-final`);
    if (handled) {
      throw new SessionExpiredError();
    }
  }

  throw lastError ?? new Error('Firestore request failed');
}

const SNAPSHOT_RETRY_DELAY_MS = 400;
const SNAPSHOT_RETRY_MAX_ELAPSED_MS = 8_000;

export function attachRetriableSnapshot(
  attach: (onError: (error: Error) => void) => Unsubscribe,
  onError?: (error: Error) => void,
  context = 'firestore-snapshot',
  maxElapsedMs = SNAPSHOT_RETRY_MAX_ELAPSED_MS,
): Unsubscribe {
  let retryCount = 0;
  let retryStartedAt: number | null = null;
  let innerUnsub: Unsubscribe | undefined;
  let cancelled = false;
  let retryTimer: number | undefined;

  const start = () => {
    innerUnsub?.();
    innerUnsub = attach((error) => {
      if (cancelled) {
        return;
      }

      if (isFirestorePermissionDenied(error)) {
        if (retryStartedAt === null) {
          retryStartedAt = Date.now();
        }

        void handleFirestorePermissionDenied(error, context).then((handled) => {
          if (cancelled) {
            return;
          }

          if (handled) {
            onError?.(new SessionExpiredError());
            return;
          }

          const elapsedMs = Date.now() - (retryStartedAt ?? Date.now());
          if (elapsedMs < maxElapsedMs) {
            retryCount += 1;
            const delay = Math.min(SNAPSHOT_RETRY_DELAY_MS * retryCount, 1_200);
            debugLog.debug('auth', 'Retriable snapshot: retrying after permission-denied', {
              context,
              retryCount,
              elapsedMs,
              nextDelayMs: delay,
            });
            retryTimer = window.setTimeout(start, delay);
            return;
          }

          debugLog.warn('auth', 'Retriable snapshot: permission-denied retries exhausted', {
            context,
            retryCount,
            elapsedMs,
            maxElapsedMs,
          });
          onError?.(error);
        });
        return;
      }

      retryStartedAt = null;
      retryCount = 0;

      if (isSessionExpiredError(error)) {
        onError?.(error instanceof Error ? error : new SessionExpiredError());
        return;
      }

      onError?.(error);
    });
  };

  start();

  return () => {
    cancelled = true;
    if (retryTimer !== undefined) {
      window.clearTimeout(retryTimer);
    }
    innerUnsub?.();
  };
}

export {
  createFirestoreSnapshotErrorHandler,
  handleFirestorePermissionDenied,
  isFirestorePermissionDenied,
  isSessionExpiredError,
  SessionExpiredError,
} from '@/features/auth/services/sessionExpiry';
