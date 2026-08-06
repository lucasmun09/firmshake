import { Capacitor } from '@capacitor/core';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref } from 'vue';

import type { UserProfile } from '@/types';
import { debugLog, serializeError } from '@/common/debug/debugLog';
import { formatDisplayName, parseDisplayName } from '@/utils/displayName';
import { clearPendingMfaPhone } from '@/utils/phoneNumber';
import { clearSessionMetadata } from '@/features/auth/services/sessionExpiry';
import { assertNotPlatformBanned } from '@/common/services/platformBanCheck';
import { assertRecaptchaVerified } from '@/common/services/recaptchaGate';
import { startAppBootstrap, startGuestBootstrap, stopAppBootstrap, refreshBootstrapCommunities } from '@/common/services/appBootstrap';
import { clearResponseCache } from '@/common/services/responseCache';
import { ensureCommunitiesSeeded } from '@/features/communities/services/communities';
import { auth, db, isFirebaseConfigured, firebaseConfig } from '@/common/services/firebase';
import {
  clearFirestoreAuthCache,
  isSessionExpiredError,
  prepareFirestoreSession,
  waitForFirestoreAuth,
  withFirestoreRetry,
} from '@/common/services/firestoreAuth';
import { resetFirestoreConnection } from '@/common/services/firebase';
import {
  extendSessionOnLogin,
  initProactiveSessionMaintenance,
} from '@/features/auth/services/sessionExpiry';
import { initPushNotifications, resetPushNotifications } from '@/common/services/pushNotifications';
import { isLogsRoute } from '@/router/logsRoute';
import {
  captureMultiFactorResolver,
  clearPersistedMfaEnrollmentState,
  clearRecaptchaVerifier,
  isMfaEnrolled,
  isPasswordAuthUser,
  setPendingMfaResolver,
  unenrollAllSmsMfa,
} from '@/features/auth/services/mfa';
import { formatAuthError, getAuthErrorCode } from '@/features/auth/utils/authErrors';

const GOOGLE_REDIRECT_PENDING_KEY = 'firmshake:googleRedirectPending';
const GOOGLE_REDIRECT_GRACE_MS = 8000;
const GOOGLE_REDIRECT_PENDING_TTL_MS = 2 * 60 * 1000;

type GoogleRedirectPendingRecord = {
  action: string;
  at: number;
};

function readGoogleRedirectPendingRecord(): GoogleRedirectPendingRecord | null {
  if (typeof sessionStorage !== 'undefined') {
    const sessionValue = sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY);
    if (sessionValue) {
      return { action: sessionValue, at: Date.now() };
    }
  }

  if (typeof localStorage === 'undefined') {
    return null;
  }

  const localRaw = localStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY);
  if (!localRaw) {
    return null;
  }

  try {
    const parsed = JSON.parse(localRaw) as GoogleRedirectPendingRecord;
    if (
      typeof parsed.at !== 'number'
      || Date.now() - parsed.at > GOOGLE_REDIRECT_PENDING_TTL_MS
    ) {
      localStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
      return null;
    }

    return parsed;
  } catch {
    return { action: localRaw, at: Date.now() };
  }
}

function setGoogleRedirectPending(action: string): void {
  const record: GoogleRedirectPendingRecord = { action, at: Date.now() };

  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, action);
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, JSON.stringify(record));
  }

  debugLog.info('auth', 'Google redirect pending flag set', {
    action,
    sessionStorage: typeof sessionStorage !== 'undefined',
    localStorage: typeof localStorage !== 'undefined',
    routePath: typeof window !== 'undefined' ? window.location.pathname : undefined,
  });
}

function clearGoogleRedirectPending(reason = 'unknown'): void {
  const hadSession = typeof sessionStorage !== 'undefined'
    && sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY) !== null;
  const hadLocal = typeof localStorage !== 'undefined'
    && localStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY) !== null;

  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
  }

  if (hadSession || hadLocal) {
    debugLog.info('auth', 'Google redirect pending flag cleared', {
      reason,
      hadSession,
      hadLocal,
      routePath: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
  }
}

let authEventSeq = 0;
let googleRedirectSettledAt = 0;
let signOutInProgress = false;
let googleRedirectInitPromise: Promise<void> | null = null;

function nextAuthSeq(): number {
  authEventSeq += 1;
  return authEventSeq;
}

function isInPostRedirectGrace(): boolean {
  return googleRedirectSettledAt > 0
    && Date.now() - googleRedirectSettledAt < GOOGLE_REDIRECT_GRACE_MS;
}

function shouldIgnoreSignedOutAuthCallback(): boolean {
  return isGoogleRedirectPending() || isInPostRedirectGrace();
}

function isGoogleRedirectPending(): boolean {
  return googleRedirectProcessing.value || readGoogleRedirectPendingRecord() !== null;
}

function logGoogleRedirectPhase(phase: string, data?: Record<string, unknown>): void {
  debugLog.info('auth', `Google redirect: ${phase}`, {
    seq: nextAuthSeq(),
    authReady: authReady.value,
    googleRedirectProcessing: googleRedirectProcessing.value,
    pendingInSession: readGoogleRedirectPendingRecord() !== null,
    currentUserUid: currentUser.value?.uid ?? null,
    authCurrentUserUid: auth?.currentUser?.uid ?? null,
    inPostRedirectGrace: isInPostRedirectGrace(),
    msSinceRedirectSettled: googleRedirectSettledAt > 0
      ? Date.now() - googleRedirectSettledAt
      : null,
    routePath: typeof window !== 'undefined' ? window.location.pathname : undefined,
    ...data,
  });
}

export const currentUser = ref<User | null>(null);
export const authReady = ref(false);

const AUTH_STATE_READY_MAX_MS = 15000;
const REDIRECT_RESULT_TIMEOUT_MS = 5000;

function syncCurrentUserFromFirebaseSession(reason: string): User | null {
  if (signOutInProgress || !auth?.currentUser) {
    return null;
  }

  if (!currentUser.value || currentUser.value.uid !== auth.currentUser.uid) {
    currentUser.value = auth.currentUser;
    debugLog.info('auth', 'Synced currentUser from Firebase session', {
      uid: auth.currentUser.uid,
      reason,
    });
  }

  return auth.currentUser;
}

export async function ensureAuthInitialized(maxMs = AUTH_STATE_READY_MAX_MS): Promise<void> {
  if (authReady.value) {
    return;
  }

  if (!auth) {
    authReady.value = true;
    return;
  }

  const started = Date.now();

  try {
    await Promise.race([
      auth.authStateReady(),
      new Promise<void>((_, reject) => {
        window.setTimeout(
          () => reject(new Error('auth-state-ready-timeout')),
          maxMs,
        );
      }),
    ]);
  } catch (err) {
    debugLog.warn('auth', 'authStateReady timed out during initialization', {
      elapsedMs: Date.now() - started,
      authCurrentUserUid: auth.currentUser?.uid ?? null,
      error: serializeError(err),
    });
  }

  syncCurrentUserFromFirebaseSession('ensureAuthInitialized');
  authReady.value = true;
}

async function getRedirectResultWithTimeout() {
  if (!auth) {
    return null;
  }

  return Promise.race([
    getRedirectResult(auth),
    new Promise<Awaited<ReturnType<typeof getRedirectResult>>>((resolve) => {
      window.setTimeout(() => {
        debugLog.warn('auth', 'getRedirectResult timed out; continuing without redirect result', {
          timeoutMs: REDIRECT_RESULT_TIMEOUT_MS,
          authCurrentUserUid: auth?.currentUser?.uid ?? null,
        });
        resolve(null);
      }, REDIRECT_RESULT_TIMEOUT_MS);
    }),
  ]);
}

export function resolveSessionUser(): User | null {
  if (signOutInProgress) {
    return null;
  }
  return currentUser.value ?? auth?.currentUser ?? null;
}

function clearAuthSessionState(reason: string): void {
  googleRedirectError.value = null;
  clearGoogleRedirectPending(reason);
  googleRedirectProcessing.value = false;
  clearPendingMfaPhone();
  clearPersistedMfaEnrollmentState();
  clearRecaptchaVerifier();
  setPendingMfaResolver(null);
  clearSessionMetadata();
  clearFirestoreAuthCache();
  currentUser.value = null;
}
function hasSessionGoogleRedirectPending(): boolean {
  return typeof sessionStorage !== 'undefined'
    && sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY) !== null;
}

export const googleRedirectProcessing = ref(
  isFirebaseConfigured && hasSessionGoogleRedirectPending(),
);
export const googleRedirectError = ref<string | null>(null);

function waitForAuthUser(timeoutMs = 3000): Promise<User | null> {
  if (auth?.currentUser) {
    debugLog.debug('auth', 'waitForAuthUser: immediate session user', {
      uid: auth.currentUser.uid,
    });
    return Promise.resolve(auth.currentUser);
  }

  debugLog.info('auth', 'waitForAuthUser: polling auth.currentUser', { timeoutMs });

  return new Promise((resolve) => {
    const started = Date.now();
    let pollCount = 0;
    const interval = window.setInterval(() => {
      pollCount += 1;

      if (auth?.currentUser) {
        window.clearInterval(interval);
        debugLog.info('auth', 'waitForAuthUser: resolved via poll', {
          uid: auth.currentUser.uid,
          pollCount,
          elapsedMs: Date.now() - started,
        });
        resolve(auth.currentUser);
        return;
      }

      if (Date.now() - started >= timeoutMs) {
        window.clearInterval(interval);
        debugLog.warn('auth', 'waitForAuthUser: timed out without session user', {
          pollCount,
          timeoutMs,
        });
        resolve(null);
      }
    }, 100);
  });
}

async function startGoogleRedirectSignIn(
  provider: GoogleAuthProvider,
  recaptchaAction: string,
): Promise<void> {
  setGoogleRedirectPending(recaptchaAction);
  googleRedirectProcessing.value = true;

  debugLog.info('auth', 'Google redirect: calling signInWithRedirect', {
    action: recaptchaAction,
    routePath: typeof window !== 'undefined' ? window.location.pathname : undefined,
  });

  try {
    await signInWithRedirect(auth!, provider);
  } catch (err) {
    clearGoogleRedirectPending('redirect-init-failed');
    googleRedirectProcessing.value = false;
    debugLog.error('auth', 'Google redirect initiation failed', {
      error: serializeError(err),
      errorCode: getAuthErrorCode(err),
    });
    throw err;
  }
}

function waitForAuthReady(timeoutMs = 10000): Promise<boolean> {
  if (authReady.value) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const started = Date.now();
    const interval = window.setInterval(() => {
      if (authReady.value) {
        window.clearInterval(interval);
        resolve(true);
        return;
      }

      if (Date.now() - started >= timeoutMs) {
        window.clearInterval(interval);
        debugLog.warn('auth', 'Timed out waiting for authReady after redirect');
        resolve(false);
      }
    }, 50);
  });
}

function resolveAuthProvider(user: User): UserProfile['authProvider'] {
  return user.providerData.some((entry) => entry.providerId === 'google.com')
    ? 'google.com'
    : 'password';
}

export async function completeAuthenticationAfterMfa(user: User): Promise<void> {
  const started = Date.now();
  let step = 'reloadUser';

  debugLog.info('auth', 'MFA: completeAuthentication.start', {
    uid: user.uid,
    email: user.email,
    routePath: typeof window !== 'undefined' ? window.location.pathname : undefined,
  });

  try {
    debugLog.debug('auth', 'MFA: completeAuthentication step: reloadUser', {
      uid: user.uid,
      elapsedMs: Date.now() - started,
    });
    const activeUser = await reloadCurrentUser(user);
    currentUser.value = activeUser;

    step = 'firestoreReady';
    debugLog.debug('auth', 'MFA: completeAuthentication step: firestoreReady', {
      uid: activeUser.uid,
      elapsedMs: Date.now() - started,
    });
    await waitForFirestoreAuth(activeUser);

    step = 'ensureProfile';
    debugLog.debug('auth', 'MFA: completeAuthentication step: ensureProfile', {
      uid: activeUser.uid,
      elapsedMs: Date.now() - started,
    });
    await ensureUserProfile(activeUser, { authProvider: resolveAuthProvider(activeUser) });

    debugLog.info('auth', 'MFA: completeAuthentication.done', {
      uid: activeUser.uid,
      elapsedMs: Date.now() - started,
    });
    extendSessionOnLogin();
  } catch (err) {
    debugLog.error('auth', 'MFA: completeAuthentication failed', {
      uid: user.uid,
      step,
      elapsedMs: Date.now() - started,
      error: serializeError(err),
    });
    throw err;
  }
}

async function completePopupSignIn(user: User): Promise<void> {
  debugLog.info('auth', 'Google popup: completeSignIn.start', {
    uid: user.uid,
    email: user.email,
    routePath: typeof window !== 'undefined' ? window.location.pathname : undefined,
  });

  try {
    await ensureUserProfile(user, { authProvider: 'google.com' });
    debugLog.info('auth', 'Google popup: completeSignIn.profileEnsured', { uid: user.uid });
  } catch (err) {
    debugLog.error('auth', 'Google popup: ensureUserProfile failed', {
      uid: user.uid,
      error: serializeError(err),
    });
    throw err;
  }

  debugLog.info('auth', 'Google popup: completeSignIn.done', { uid: user.uid });
}

async function completeGoogleRedirectSignIn(user: User): Promise<void> {
  logGoogleRedirectPhase('completeSignIn.start', {
    uid: user.uid,
    email: user.email,
  });

  if (signOutInProgress || !auth?.currentUser) {
    logGoogleRedirectPhase('completeSignIn.aborted', {
      uid: user.uid,
      reason: signOutInProgress ? 'sign-out-in-progress' : 'no-firebase-session',
    });
    return;
  }

  currentUser.value = auth.currentUser;
  authReady.value = true;

  try {
    if (user.email) {
      await assertNotPlatformBanned(user.email);
    }
    await ensureUserProfile(user, { authProvider: 'google.com' });
    logGoogleRedirectPhase('completeSignIn.profileEnsured', { uid: user.uid });
  } catch (err) {
    debugLog.error('auth', 'Google redirect: ensureUserProfile failed', {
      uid: user.uid,
      error: serializeError(err),
    });
    throw err;
  }

  if (signOutInProgress || !auth?.currentUser) {
    logGoogleRedirectPhase('completeSignIn.aborted', {
      uid: user.uid,
      reason: signOutInProgress ? 'sign-out-in-progress' : 'no-firebase-session',
    });
    return;
  }

  const ready = await waitForAuthReady();
  if (!ready) {
    if (auth?.currentUser) {
      debugLog.warn('auth', 'authReady timed out during Google redirect; proceeding with session user');
      currentUser.value = auth.currentUser;
      authReady.value = true;
    } else {
      throw new Error('Authentication did not finish loading. Refresh and try again.');
    }
  }

  if (signOutInProgress || !auth?.currentUser) {
    logGoogleRedirectPhase('completeSignIn.aborted', {
      uid: user.uid,
      reason: signOutInProgress ? 'sign-out-in-progress' : 'no-firebase-session',
    });
    return;
  }

  currentUser.value = auth.currentUser;
  extendSessionOnLogin();
  logGoogleRedirectPhase('completeSignIn.beforeNavigation', {
    uid: currentUser.value?.uid ?? null,
  });

  const { default: router } = await import('@/router');
  await router.isReady();
  await navigateAfterAuthentication(router, currentUser.value ?? user);

  logGoogleRedirectPhase('completeSignIn.navigationDone');
}

if (isFirebaseConfigured && auth) {
  initProactiveSessionMaintenance();
  void ensureAuthInitialized();

  onAuthStateChanged(auth, async (user) => {
    const seq = nextAuthSeq();

    if (!user && shouldIgnoreSignedOutAuthCallback()) {
      debugLog.info('auth', 'Ignoring signed-out auth callback during Google redirect', {
        seq,
        reason: isGoogleRedirectPending() ? 'redirect-pending' : 'post-redirect-grace',
        currentUserUid: currentUser.value?.uid ?? null,
        authCurrentUserUid: auth?.currentUser?.uid ?? null,
        msSinceRedirectSettled: googleRedirectSettledAt > 0
          ? Date.now() - googleRedirectSettledAt
          : null,
      });
      return;
    }

    const previousUid = currentUser.value?.uid ?? null;
    let resolvedUser = user ?? auth?.currentUser ?? null;

    if (!user && !resolvedUser && previousUid && auth && !signOutInProgress) {
      await auth.authStateReady();
      if (auth.currentUser) {
        debugLog.warn('auth', 'Ignoring spurious signed-out callback; Firebase session still active', {
          seq,
          uid: auth.currentUser.uid,
          previousUid,
          routePath: typeof window !== 'undefined' ? window.location.pathname : undefined,
        });
        resolvedUser = auth.currentUser;
      }
    }

    if (!user && resolvedUser) {
      debugLog.warn('auth', 'Auth callback null but auth.currentUser present; using session user', {
        seq,
        uid: resolvedUser.uid,
      });
    }

    if (!resolvedUser && previousUid) {
      debugLog.warn('auth', 'Auth state changed: signed out', {
        seq,
        previousUid,
        duringGoogleRedirect: isGoogleRedirectPending(),
        inPostRedirectGrace: isInPostRedirectGrace(),
        authCurrentUserUid: auth?.currentUser?.uid ?? null,
        routePath: typeof window !== 'undefined' ? window.location.pathname : undefined,
      });
    }

    currentUser.value = resolvedUser;
    authReady.value = true;

    if (resolvedUser) {
      extendSessionOnLogin();

      debugLog.info('auth', 'Auth state changed: signed in', {
        seq,
        uid: resolvedUser.uid,
        email: resolvedUser.email,
        providers: resolvedUser.providerData.map((entry) => entry.providerId),
        previousUid,
        duringGoogleRedirect: isGoogleRedirectPending(),
        inPostRedirectGrace: isInPostRedirectGrace(),
      });

      if (previousUid && previousUid !== resolvedUser.uid) {
        clearFirestoreAuthCache();
        void resetFirestoreConnection('user-switch').catch((err) => {
          debugLog.warn('auth', 'Firestore reset after user switch failed', {
            previousUid,
            uid: resolvedUser.uid,
            error: serializeError(err),
          });
        });
      }

      void startAppBootstrap(resolvedUser.uid);
      void initPushNotifications(resolvedUser.uid);
    } else {
      stopAppBootstrap();
      resetPushNotifications();
      void startGuestBootstrap();
    }
  });

  void (async () => {
    await runGoogleRedirectInit();
  })();
} else {
  authReady.value = true;
}

async function runGoogleRedirectInit(): Promise<void> {
  if (googleRedirectInitPromise) {
    return googleRedirectInitPromise;
  }

  googleRedirectInitPromise = runGoogleRedirectInitInner();
  return googleRedirectInitPromise;
}

async function runGoogleRedirectInitInner(): Promise<void> {
  const pendingRecord = readGoogleRedirectPendingRecord();
  const hadSessionPending = hasSessionGoogleRedirectPending();
  const hadPendingRedirect = pendingRecord !== null;
  const pendingOnlyInLocalStorage = hadPendingRedirect && !hadSessionPending;

  if (pendingOnlyInLocalStorage) {
    clearGoogleRedirectPending('stale-local-only');
  }

  const hasPendingRedirect = hasSessionGoogleRedirectPending()
    || readGoogleRedirectPendingRecord() !== null;

  if (!hasPendingRedirect) {
    debugLog.debug('auth', 'Google redirect: skipped (no pending redirect on boot)', {
      hadPendingRedirect,
      hadSessionPending,
      routePath: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
    await ensureAuthInitialized();
    return;
  }

  logGoogleRedirectPhase('init', {
    hadPendingRedirect,
    hadSessionPending,
    pendingOnlyInLocalStorage,
    pendingAction: pendingRecord?.action ?? null,
    returnUrl: typeof window !== 'undefined' ? window.location.href : undefined,
    authDomain: firebaseConfig.authDomain ?? null,
    pageOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
    urlSearch: typeof window !== 'undefined' ? window.location.search : undefined,
    urlHash: typeof window !== 'undefined' ? window.location.hash.slice(0, 120) : undefined,
  });

  const needsRedirectRecovery = hadSessionPending;

  try {
    logGoogleRedirectPhase('getRedirectResult.calling');
    const result = await getRedirectResultWithTimeout();
    logGoogleRedirectPhase('getRedirectResult.done', {
      hasResultUser: Boolean(result?.user),
      resultUid: result?.user?.uid ?? null,
      resultEmail: result?.user?.email ?? null,
      providerId: result?.providerId ?? null,
      operationType: result?.operationType ?? null,
      authCurrentUserUid: auth!.currentUser?.uid ?? null,
    });

    if (!needsRedirectRecovery) {
      if (result?.user) {
        googleRedirectError.value = null;
        await completeGoogleRedirectSignIn(result.user);
        logGoogleRedirectPhase('flow.completed');
      } else {
        debugLog.debug('auth', 'Google redirect result: none (normal page load)');
      }
      return;
    }

    let sessionUser = result?.user ?? auth!.currentUser;
    const shouldRecoverRedirect = Boolean(result?.user || hadSessionPending);

    if (!sessionUser && hadSessionPending) {
      logGoogleRedirectPhase('authStateReady.waiting');
      await auth!.authStateReady();
      sessionUser = auth!.currentUser ?? await waitForAuthUser();
      logGoogleRedirectPhase('authStateReady.done', {
        authCurrentUserUid: auth!.currentUser?.uid ?? null,
        authCurrentUserEmail: auth!.currentUser?.email ?? null,
        resolvedViaPoll: Boolean(sessionUser && !result?.user),
      });
    }

    if (sessionUser && shouldRecoverRedirect) {
      googleRedirectError.value = null;
      if (!result?.user) {
        debugLog.warn('auth', 'Google redirect: empty getRedirectResult, using auth session fallback', {
          uid: sessionUser.uid,
          email: sessionUser.email,
        });
      }
      await completeGoogleRedirectSignIn(sessionUser);
      logGoogleRedirectPhase(result?.user ? 'flow.completed' : 'flow.completedViaFallback');
    } else if (hadSessionPending) {
      googleRedirectError.value =
        'Google sign-in did not complete. Please try again or use email and password.';
      debugLog.error('auth', 'Google redirect failed: no user in redirect result or session', {
        hadPendingRedirect,
        authReady: authReady.value,
        currentUserUid: currentUser.value?.uid ?? null,
        authDomain: firebaseConfig.authDomain ?? null,
        pageOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
      });
    } else {
      debugLog.debug('auth', 'Google redirect result: none (normal page load)');
    }
  } catch (err) {
    if (captureMultiFactorResolver(err)) {
      debugLog.info('auth', 'Google redirect result: MFA challenge required');
      googleRedirectError.value = null;

      const ready = await waitForAuthReady();
      if (ready) {
        const { default: router } = await import('@/router');
        await router.isReady();
        if (!isLogsRoute(router.currentRoute.value)) {
          await router.replace('/mfa-challenge');
        } else {
          debugLog.info('auth', 'MFA challenge redirect skipped: user is on debug logs page');
        }
      }
    } else {
      googleRedirectError.value = formatAuthError(err, 'google');
      debugLog.error('auth', 'Google redirect sign-in failed', {
        error: serializeError(err),
        authCurrentUserUid: auth?.currentUser?.uid ?? null,
        currentUserUid: currentUser.value?.uid ?? null,
      });

      if (auth?.currentUser && !currentUser.value) {
        debugLog.warn('auth', 'Google redirect failed but Firebase session exists; syncing currentUser');
        currentUser.value = auth.currentUser;
      }
    }
  } finally {
    clearGoogleRedirectPending('redirect-flow-finally');
    googleRedirectProcessing.value = false;
    googleRedirectSettledAt = Date.now();

    if (!authReady.value) {
      authReady.value = true;
      debugLog.warn('auth', 'Google redirect flow ended without authReady; forcing ready', {
        seq: nextAuthSeq(),
        authCurrentUserUid: auth?.currentUser?.uid ?? null,
        currentUserUid: currentUser.value?.uid ?? null,
      });
    }

    logGoogleRedirectPhase('cleanup.done');
  }
}

async function ensureUserProfile(
  user: User,
  options?: {
    firstName?: string;
    lastName?: string;
    authProvider?: UserProfile['authProvider'];
  },
): Promise<void> {
  if (!db) return;

  const userRef = doc(db, 'users', user.uid);
  const parsed = parseDisplayName(user.displayName ?? '');
  const firstName = options?.firstName?.trim() || parsed.firstName;
  const lastName = options?.lastName?.trim() || parsed.lastName;
  const authProvider =
    options?.authProvider ?? (user.providerData[0]?.providerId === 'google.com'
      ? 'google.com'
      : 'password');
  const profileComplete = authProvider === 'password'
    ? false
    : Boolean(firstName && lastName);
  const accountSetupComplete = authProvider !== 'password';

  const profile: Omit<UserProfile, 'uid'> & { createdAt: ReturnType<typeof serverTimestamp> } = {
    email: (user.email ?? '').toLowerCase(),
    firstName,
    lastName,
    displayName: formatDisplayName(firstName, lastName) || user.displayName || 'FirmShake User',
    communityIds: ['all'],
    isAdmin: false,
    isSuperAdmin: false,
    moderatorCommunityIds: [],
    profileComplete,
    accountSetupComplete,
    authProvider,
    createdAt: serverTimestamp(),
  };

  await withFirestoreRetry(async () => {
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) {
      return;
    }

    await setDoc(userRef, profile);
  }, user);
}

export async function registerWithEmail(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
): Promise<User> {
  if (!auth) {
    throw new Error('Firebase is not configured. Add credentials to .env.local');
  }

  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();
  if (!trimmedFirst || !trimmedLast) {
    throw new Error('First name and last name are required');
  }

  await assertRecaptchaVerified('register');

  debugLog.info('auth', 'Registering with email', { email: email.trim().toLowerCase() });

  await assertNotPlatformBanned(email);

  const displayName = formatDisplayName(trimmedFirst, trimmedLast);
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName });
  await ensureUserProfile(credential.user, {
    firstName: trimmedFirst,
    lastName: trimmedLast,
    authProvider: 'password',
  });

  try {
    await sendEmailVerification(credential.user);
    debugLog.info('auth', 'Verification email sent after registration', {
      uid: credential.user.uid,
      email: credential.user.email,
    });
  } catch (err) {
    debugLog.warn('auth', 'Failed to send verification email after registration', {
      uid: credential.user.uid,
      error: serializeError(err),
    });
  }

  extendSessionOnLogin();
  debugLog.info('auth', 'Email registration succeeded', { uid: credential.user.uid });
  return credential.user;
}

export async function sendVerificationEmail(user?: User): Promise<void> {
  if (!auth) {
    throw new Error('Firebase is not configured');
  }

  const target = user ?? auth.currentUser;
  if (!target) {
    throw new Error('You must be signed in to send a verification email');
  }

  await sendEmailVerification(target);
  debugLog.info('auth', 'Verification email sent', {
    uid: target.uid,
    email: target.email,
  });
}

const RELOAD_USER_MAX_ATTEMPTS = 3;
const RELOAD_USER_RETRY_DELAY_MS = 300;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function syncAuthSessionAfterSignIn(
  user: User,
  context = 'post-sign-in',
): Promise<User> {
  if (!auth) {
    throw new Error('Firebase is not configured');
  }

  await auth.authStateReady();
  const sessionUser = auth.currentUser;
  if (!sessionUser || sessionUser.uid !== user.uid) {
    throw new Error('You must be signed in');
  }

  debugLog.info('auth', 'syncAuthSessionAfterSignIn: refreshing token', {
    context,
    uid: sessionUser.uid,
  });

  let lastError: unknown;
  for (let attempt = 1; attempt <= RELOAD_USER_MAX_ATTEMPTS; attempt += 1) {
    try {
      await sessionUser.getIdToken(true);
      currentUser.value = sessionUser;
      extendSessionOnLogin();
      debugLog.info('auth', 'syncAuthSessionAfterSignIn: session synced', {
        context,
        uid: sessionUser.uid,
        attempt,
      });
      return sessionUser;
    } catch (err) {
      lastError = err;
      const errorCode = getAuthErrorCode(err);
      debugLog.warn('auth', 'syncAuthSessionAfterSignIn: token refresh failed', {
        context,
        uid: sessionUser.uid,
        attempt,
        errorCode,
        willRetry: attempt < RELOAD_USER_MAX_ATTEMPTS && errorCode === 'auth/internal-error',
      });

      if (attempt < RELOAD_USER_MAX_ATTEMPTS && errorCode === 'auth/internal-error') {
        await delay(RELOAD_USER_RETRY_DELAY_MS * attempt);
        continue;
      }

      throw err;
    }
  }

  throw lastError ?? new Error('You must be signed in');
}

export async function reloadCurrentUser(user?: User): Promise<User> {
  if (!auth) {
    throw new Error('Firebase is not configured');
  }

  const initialTarget = user ?? auth.currentUser ?? currentUser.value;
  if (!initialTarget) {
    throw new Error('You must be signed in');
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= RELOAD_USER_MAX_ATTEMPTS; attempt += 1) {
    const target = auth.currentUser ?? user ?? currentUser.value ?? initialTarget;

    try {
      debugLog.debug('auth', 'reloadCurrentUser: attempt', {
        uid: target.uid,
        attempt,
      });

      await target.getIdToken(true);
      await target.reload();
      const refreshed = auth.currentUser ?? target;
      currentUser.value = refreshed;
      debugLog.info('auth', 'reloadCurrentUser: succeeded', {
        uid: refreshed.uid,
        attempt,
      });
      return refreshed;
    } catch (err) {
      lastError = err;
      const errorCode = getAuthErrorCode(err);
      debugLog.warn('auth', 'reloadCurrentUser: attempt failed', {
        uid: target.uid,
        attempt,
        errorCode,
        willRetry: attempt < RELOAD_USER_MAX_ATTEMPTS && errorCode === 'auth/internal-error',
      });

      if (attempt < RELOAD_USER_MAX_ATTEMPTS && errorCode === 'auth/internal-error') {
        await delay(RELOAD_USER_RETRY_DELAY_MS * attempt);
        continue;
      }

      throw err;
    }
  }

  throw lastError ?? new Error('You must be signed in');
}

export async function loginWithGoogle(
  recaptchaAction: 'google_login' | 'google_register' = 'google_login',
): Promise<User | void> {
  if (!auth) {
    throw new Error('Firebase is not configured. Add credentials to .env.local');
  }

  googleRedirectError.value = null;

  await assertRecaptchaVerified(recaptchaAction);

  const provider = new GoogleAuthProvider();
  const useRedirectOnly = Capacitor.isNativePlatform();
  const strategy = useRedirectOnly ? 'redirect' : 'popup-first';

  debugLog.info('auth', 'loginWithGoogle: entry', {
    action: recaptchaAction,
    strategy,
    nativePlatform: useRedirectOnly,
    origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    authDomain: firebaseConfig.authDomain ?? null,
    routePath: typeof window !== 'undefined' ? window.location.pathname : undefined,
    authCurrentUserUid: auth.currentUser?.uid ?? null,
    currentUserUid: currentUser.value?.uid ?? null,
  });

  if (!useRedirectOnly) {
    googleRedirectProcessing.value = true;

    try {
      debugLog.info('auth', 'Google popup: calling signInWithPopup');
      const result = await signInWithPopup(auth, provider);
      googleRedirectProcessing.value = false;
      debugLog.info('auth', 'Google popup sign-in succeeded', {
        uid: result.user.uid,
        email: result.user.email,
        providerId: result.providerId ?? null,
        operationType: result.operationType ?? null,
      });
      if (result.user.email) {
        await assertNotPlatformBanned(result.user.email);
      }
      await completePopupSignIn(result.user);
      extendSessionOnLogin();
      return result.user;
    } catch (err) {
      googleRedirectProcessing.value = false;

      if (captureMultiFactorResolver(err)) {
        debugLog.info('auth', 'Google popup sign-in: MFA challenge required', {
          errorCode: getAuthErrorCode(err),
        });
        return;
      }

      const errorCode = getAuthErrorCode(err);
      if (errorCode === 'auth/popup-closed-by-user') {
        debugLog.info('auth', 'Google popup closed by user', { errorCode });
        return;
      }

      if (errorCode === 'auth/popup-blocked') {
        debugLog.warn('auth', 'Google popup blocked; falling back to redirect', {
          errorCode,
          routePath: typeof window !== 'undefined' ? window.location.pathname : undefined,
        });
      } else {
        debugLog.error('auth', 'Google popup sign-in failed', {
          error: serializeError(err),
          errorCode,
        });
        throw err;
      }
    }
  }

  debugLog.info('auth', 'Google redirect: starting redirect sign-in', {
    action: recaptchaAction,
    reason: useRedirectOnly ? 'native-platform' : 'popup-blocked-fallback',
    origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    authDomain: firebaseConfig.authDomain ?? null,
  });

  await startGoogleRedirectSignIn(provider, recaptchaAction);
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  if (!auth) {
    throw new Error('Firebase is not configured. Add credentials to .env.local');
  }

  const started = Date.now();
  await assertRecaptchaVerified('login');

  debugLog.info('auth', 'login: started', {
    email: email.trim().toLowerCase(),
    elapsedMs: Date.now() - started,
  });

  await assertNotPlatformBanned(email);

  const credential = await signInWithEmailAndPassword(auth, email, password);
  debugLog.info('auth', 'login: firebase complete', {
    uid: credential.user.uid,
    elapsedMs: Date.now() - started,
  });

  extendSessionOnLogin();
  debugLog.info('auth', 'login: returning user for navigation', {
    uid: credential.user.uid,
    elapsedMs: Date.now() - started,
  });
  return credential.user;
}

const POST_AUTH_BYPASS_KEY = 'firmshake:postAuthBypass';
const POST_AUTH_BYPASS_MS = 30_000;
const POST_AUTH_PROFILE_TIMEOUT_MS = 2500;

export type NavigateAfterAuthOptions = {
  fromMfaChallenge?: boolean;
  destination?: string;
};

type PostAuthBypassRecord = {
  uid: string;
  until: number;
};

export function setPostAuthBypass(uid: string): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  const record: PostAuthBypassRecord = {
    uid,
    until: Date.now() + POST_AUTH_BYPASS_MS,
  };
  sessionStorage.setItem(POST_AUTH_BYPASS_KEY, JSON.stringify(record));
}

export function shouldBypassPostAuthGuard(uid: string): boolean {
  if (typeof sessionStorage === 'undefined') {
    return false;
  }

  try {
    const raw = sessionStorage.getItem(POST_AUTH_BYPASS_KEY);
    if (!raw) {
      return false;
    }

    const record = JSON.parse(raw) as PostAuthBypassRecord;
    return record.uid === uid && Date.now() < record.until;
  } catch {
    return false;
  }
}

async function bootstrapPostAuthInBackground(user: User): Promise<void> {
  const started = Date.now();

  try {
    await waitForFirestoreAuth(user);
    await ensureUserProfile(user, { authProvider: resolveAuthProvider(user) });
    await ensureCommunitiesSeeded();
    debugLog.info('auth', 'Post-auth background bootstrap complete', {
      uid: user.uid,
      elapsedMs: Date.now() - started,
    });
  } catch (err) {
    if (isSessionExpiredError(err)) {
      return;
    }
    debugLog.warn('auth', 'Post-auth background bootstrap failed', {
      uid: user.uid,
      elapsedMs: Date.now() - started,
      error: serializeError(err),
    });
  }

  void startAppBootstrap(user.uid);

  try {
    await refreshBootstrapCommunities();
  } catch (err) {
    debugLog.warn('auth', 'Post-auth community refresh failed', {
      uid: user.uid,
      error: serializeError(err),
    });
  }

  void initPushNotifications(user.uid);
}

async function resolvePostAuthDestination(
  user: User,
  options?: NavigateAfterAuthOptions,
): Promise<string> {
  if (options?.destination) {
    return options.destination;
  }

  const { resolvePostAuthPath } = await import('@/features/auth/services/postAuthFlow');
  const { isMfaEnrolled } = await import('@/features/auth/services/mfa');

  if (options?.fromMfaChallenge) {
    debugLog.info('auth', 'Post-auth fast path: MFA challenge complete → home', {
      uid: user.uid,
      mfaEnrolled: isMfaEnrolled(user),
    });
    return '/tabs/home';
  }

  const profileStarted = Date.now();

  try {
    const { getUserProfile } = await import('@/common/services/users');
    const profile = await Promise.race([
      getUserProfile(user.uid),
      new Promise<null>((_, reject) => {
        window.setTimeout(
          () => reject(new Error('profile-fetch-timeout')),
          POST_AUTH_PROFILE_TIMEOUT_MS,
        );
      }),
    ]);
    debugLog.info('auth', 'Post-auth destination resolved via profile', {
      uid: user.uid,
      hasProfile: Boolean(profile),
      elapsedMs: Date.now() - profileStarted,
    });
    return resolvePostAuthPath(user, profile);
  } catch (err) {
    debugLog.info('auth', 'Post-auth destination fallback (profile fetch skipped)', {
      uid: user.uid,
      elapsedMs: Date.now() - profileStarted,
      error: serializeError(err),
      mfaEnrolled: isMfaEnrolled(user),
    });

    if (isMfaEnrolled(user)) {
      return '/tabs/home';
    }

    if (!isPasswordAuthUser(user)) {
      return '/tabs/home';
    }

    return '/mfa-enroll';
  }
}

export async function navigateAfterAuthentication(
  router: { replace: (path: string) => unknown; currentRoute?: { value: { name?: string | symbol | null; path: string } } },
  userOverride?: User,
  options?: NavigateAfterAuthOptions,
): Promise<void> {
  if (signOutInProgress) {
    debugLog.info('auth', 'Post-auth navigation skipped: sign-out in progress', {
      signOutInProgress,
    });
    return;
  }

  if (!auth) {
    debugLog.info('auth', 'Post-auth navigation skipped: Firebase not configured');
    return;
  }

  await auth.authStateReady();

  const sessionUser = auth.currentUser;
  if (!sessionUser) {
    debugLog.info('auth', 'Post-auth navigation skipped: no Firebase session', {
      overrideUid: userOverride?.uid ?? null,
      currentUserUid: currentUser.value?.uid ?? null,
    });
    return;
  }

  currentUser.value = sessionUser;

  const user = userOverride ?? sessionUser;
  if (user.uid !== sessionUser.uid) {
    debugLog.warn('auth', 'Post-auth navigation skipped: stale or missing user', {
      overrideUid: userOverride?.uid ?? null,
      currentUserUid: currentUser.value?.uid ?? null,
      authCurrentUserUid: sessionUser.uid,
    });
    return;
  }

  const currentRoute = router.currentRoute?.value;
  const currentPath = currentRoute?.path
    ?? (typeof window !== 'undefined' ? window.location.pathname : undefined);
  if (currentPath === '/logs' || (currentRoute && isLogsRoute(currentRoute))) {
    debugLog.info('auth', 'Post-auth navigation skipped: user is on debug logs page', {
      uid: user.uid,
      currentPath,
    });
    return;
  }

  const navStarted = Date.now();
  const destination = await resolvePostAuthDestination(user, options);
  const { isMfaEnrolled } = await import('@/features/auth/services/mfa');

  debugLog.info('auth', 'Post-auth navigation', {
    seq: nextAuthSeq(),
    destination,
    uid: user.uid,
    fromMfaChallenge: options?.fromMfaChallenge ?? false,
    mfaEnrolled: isMfaEnrolled(user),
    currentRoute: typeof window !== 'undefined' ? window.location.pathname : undefined,
    elapsedMs: Date.now() - navStarted,
  });

  setPostAuthBypass(user.uid);

  if (options?.fromMfaChallenge) {
    await resetFirestoreConnection('mfa-login');
  }

  try {
    await prepareFirestoreSession(user);
    await waitForFirestoreAuth(user);
  } catch (err) {
    if (isSessionExpiredError(err)) {
      return;
    }
    debugLog.warn('auth', 'Post-auth Firestore prep incomplete; browse will retry', {
      uid: user.uid,
      error: serializeError(err),
    });
  }

  try {
    const navigationResult = await router.replace(destination);
    debugLog.info('auth', 'Post-auth navigation complete', {
      seq: nextAuthSeq(),
      destination,
      navigationResult: navigationResult ?? null,
      routeAfter: typeof window !== 'undefined' ? window.location.pathname : undefined,
      elapsedMs: Date.now() - navStarted,
    });
  } catch (err) {
    debugLog.error('auth', 'Post-auth navigation failed', {
      seq: nextAuthSeq(),
      destination,
      uid: user.uid,
      elapsedMs: Date.now() - navStarted,
      error: serializeError(err),
      routePath: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
    throw err;
  }

  const routeAfter = router.currentRoute?.value?.path
    ?? (typeof window !== 'undefined' ? window.location.pathname : undefined);
  if (options?.fromMfaChallenge && routeAfter === '/mfa-challenge') {
    debugLog.warn('auth', 'Post-auth MFA: still on challenge page, hard redirect', {
      uid: user.uid,
      destination,
      elapsedMs: Date.now() - navStarted,
    });
    if (typeof window !== 'undefined') {
      window.location.assign(destination);
    }
    return;
  }

  void bootstrapPostAuthInBackground(user);
}

export async function logout(): Promise<void> {
  if (!auth) return;

  const uid = currentUser.value?.uid ?? auth.currentUser?.uid ?? null;
  const routePath = typeof window !== 'undefined' ? window.location.pathname : undefined;

  debugLog.info('auth', 'Signing out', { uid, routePath });

  signOutInProgress = true;
  clearAuthSessionState('logout');
  stopAppBootstrap();

  clearResponseCache();

  const { clearAuthenticatedImageCache } = await import('@/common/services/images');
  clearAuthenticatedImageCache();

  try {
    await resetFirestoreConnection('logout');
  } catch (err) {
    debugLog.warn('auth', 'Firestore reset during logout failed', {
      uid,
      error: serializeError(err),
    });
  }

  try {
    await signOut(auth);
    debugLog.info('auth', 'Sign out complete', { uid, routePath });
  } catch (err) {
    debugLog.error('auth', 'Sign out failed', {
      uid,
      routePath,
      error: serializeError(err),
    });
    throw err;
  } finally {
    signOutInProgress = false;
    currentUser.value = null;
  }
}

export async function abandonIncompleteRegistration(): Promise<void> {
  if (!auth) {
    throw new Error('Firebase is not configured');
  }

  const user = resolveSessionUser();
  if (!user) {
    throw new Error('You must be signed in to start over');
  }

  if (!isPasswordAuthUser(user)) {
    throw new Error('Start over is only available for email sign-up. Sign out and use a different Google account.');
  }

  debugLog.info('auth', 'abandonIncompleteRegistration: start', {
    uid: user.uid,
    email: user.email,
    mfaEnrolled: isMfaEnrolled(user),
  });

  const { getUserProfile, deleteUserProfile, isIncompletePasswordRegistration } =
    await import('@/common/services/users');
  const profile = await withFirestoreRetry(() => getUserProfile(user.uid), user);

  if (!isIncompletePasswordRegistration(profile, { authProvider: 'password' })) {
    throw new Error('This account is already set up. Sign out to use a different account.');
  }

  if (isMfaEnrolled(user)) {
    debugLog.info('auth', 'abandonIncompleteRegistration: unenrolling MFA factors', {
      uid: user.uid,
      mfaEnrolled: isMfaEnrolled(user),
    });

    try {
      await unenrollAllSmsMfa(user);
    } catch (err) {
      debugLog.warn('auth', 'abandonIncompleteRegistration: MFA cleanup failed (continuing)', {
        uid: user.uid,
        error: serializeError(err),
        errorCode: getAuthErrorCode(err),
      });
    }
  }

  if (profile) {
    debugLog.info('auth', 'abandonIncompleteRegistration: deleting Firestore profile', {
      uid: user.uid,
      accountSetupComplete: profile.accountSetupComplete,
    });

    try {
      await withFirestoreRetry(() => deleteUserProfile(user.uid), user);
    } catch (err) {
      if (getAuthErrorCode(err) === 'permission-denied') {
        throw new Error(
          'We could not remove your saved profile. Sign out, wait a moment, and try Start over again.',
        );
      }

      throw err;
    }
  }

  clearPendingMfaPhone();
  clearPersistedMfaEnrollmentState();
  clearRecaptchaVerifier();

  const deleteTarget = auth.currentUser ?? user;

  try {
    await deleteTarget.getIdToken(true);
  } catch (err) {
    debugLog.warn('auth', 'abandonIncompleteRegistration: token refresh failed before deleteUser', {
      uid: user.uid,
      error: serializeError(err),
      errorCode: getAuthErrorCode(err),
    });
  }

  try {
    debugLog.info('auth', 'abandonIncompleteRegistration: deleting Firebase Auth user', {
      uid: deleteTarget.uid,
      email: deleteTarget.email,
    });
    await deleteUser(deleteTarget);
  } catch (err) {
    const code = getAuthErrorCode(err);
    debugLog.error('auth', 'abandonIncompleteRegistration: deleteUser failed', {
      uid: deleteTarget.uid,
      error: serializeError(err),
      errorCode: code,
    });

    try {
      await signOut(auth);
    } catch (signOutErr) {
      debugLog.warn('auth', 'abandonIncompleteRegistration: signOut after deleteUser failure failed', {
        uid: deleteTarget.uid,
        error: serializeError(signOutErr),
      });
    }

    currentUser.value = null;

    if (code === 'auth/requires-recent-login') {
      throw new Error('For security, sign in again before starting over.');
    }

    if (code === 'auth/internal-error') {
      throw new Error(
        'We could not fully delete your account. Sign out, wait a minute, and try registering again. If the email is still blocked, contact support.',
      );
    }

    throw err;
  }

  currentUser.value = null;
  debugLog.info('auth', 'abandonIncompleteRegistration: complete');
}
