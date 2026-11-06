import {
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  getMultiFactorResolver,
  multiFactor,
  type Auth,
  type MultiFactorError,
  type MultiFactorResolver,
  type User,
} from 'firebase/auth';

import { auth } from '@/common/services/firebase';
import { withFirestoreRetry } from '@/common/services/firestoreAuth';
import { debugLog, maskPhoneNumber, serializeError } from '@/common/debug/debugLog';
import {
  freeLocalStorageForAuth,
  isQuotaExceededError,
} from '@/common/services/localStorageQuota';
import {
  getAuthErrorCode,
  MFA_INTERNAL_ERROR_CODES,
} from '@/features/auth/utils/authErrors';
import { isRecaptchaDisabled, resetLoginRecaptchaForPhoneMfa } from '@/utils/recaptcha';

type IdTokenClaims = {
  email_verified?: boolean;
  auth_time?: number;
};

async function readIdTokenClaims(user: User, forceRefresh = false): Promise<IdTokenClaims | null> {
  try {
    const token = await user.getIdToken(forceRefresh);
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized)) as IdTokenClaims;
    return {
      email_verified: decoded.email_verified === true,
      auth_time: typeof decoded.auth_time === 'number' ? decoded.auth_time : undefined,
    };
  } catch {
    return null;
  }
}

function attachMfaStep(error: unknown, step: string): unknown {
  if (typeof error === 'object' && error !== null) {
    Object.assign(error, { mfaStep: step });
  }
  return error;
}

function normalizeMfaSendError(error: unknown, step: string): unknown {
  if (isQuotaExceededError(error)) {
    debugLog.error('mfa', 'MFA SMS blocked by localStorage quota', {
      internalCode: MFA_INTERNAL_ERROR_CODES.STORAGE_QUOTA,
      step,
      error: serializeError(error),
    });
    return Object.assign(
      error instanceof Error ? error : new Error('Storage quota exceeded'),
      {
        code: 'firmshake/storage-quota-exceeded',
        mfaStep: step,
      },
    );
  }

  return attachMfaStep(error, step);
}

let recaptchaVerifier: RecaptchaVerifier | null = null;
let recaptchaContainerId: string | null = null;
let pendingResolver: MultiFactorResolver | null = null;

const PENDING_VERIFICATION_ID_KEY = 'firmshake.pendingMfaVerificationId';
const PENDING_ENROLL_PHONE_KEY = 'firmshake.pendingMfaEnrollPhone';

export function persistMfaEnrollmentState(verificationId: string, phoneNumber: string): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  sessionStorage.setItem(PENDING_VERIFICATION_ID_KEY, verificationId);
  sessionStorage.setItem(PENDING_ENROLL_PHONE_KEY, phoneNumber.trim());
}

export function readPersistedMfaEnrollmentState(): {
  verificationId: string;
  phoneNumber: string;
} | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }

  const verificationId = sessionStorage.getItem(PENDING_VERIFICATION_ID_KEY)?.trim() ?? '';
  const phoneNumber = sessionStorage.getItem(PENDING_ENROLL_PHONE_KEY)?.trim() ?? '';
  if (!verificationId) {
    return null;
  }

  return { verificationId, phoneNumber };
}

export function clearPersistedMfaEnrollmentState(): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  sessionStorage.removeItem(PENDING_VERIFICATION_ID_KEY);
  sessionStorage.removeItem(PENDING_ENROLL_PHONE_KEY);
}

export function isPasswordAuthUser(user: User): boolean {
  return user.providerData.some((entry) => entry.providerId === 'password');
}

export function isMfaEnrolled(user: User): boolean {
  if (multiFactor(user).enrolledFactors.length > 0) {
    return true;
  }

  const liveUser = auth?.currentUser;
  if (liveUser && liveUser.uid === user.uid && liveUser !== user) {
    return multiFactor(liveUser).enrolledFactors.length > 0;
  }

  return false;
}

export function isMultiFactorRequiredError(error: unknown): error is MultiFactorError {
  return (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code: string }).code === 'auth/multi-factor-auth-required'
  );
}

export function setPendingMfaResolver(resolver: MultiFactorResolver | null): void {
  pendingResolver = resolver;
}

export function getPendingMfaResolver(): MultiFactorResolver | null {
  return pendingResolver;
}

export function captureMultiFactorResolver(error: unknown): MultiFactorResolver | null {
  if (!auth || !isMultiFactorRequiredError(error)) {
    return null;
  }

  const resolver = getMultiFactorResolver(auth, error);
  pendingResolver = resolver;
  return resolver;
}

function requireAuth(): Auth {
  if (!auth) {
    throw new Error('Firebase is not configured');
  }
  return auth;
}

function clearRecaptchaContainer(containerId: string): void {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '';
  }
}

export function clearRecaptchaVerifier(): void {
  recaptchaVerifier?.clear();
  recaptchaVerifier = null;

  if (recaptchaContainerId) {
    clearRecaptchaContainer(recaptchaContainerId);
    recaptchaContainerId = null;
  }
}

export async function getRecaptchaVerifier(
  containerId: string,
  options?: { reuse?: boolean },
): Promise<RecaptchaVerifier> {
  const firebaseAuth = requireAuth();

  if (options?.reuse && recaptchaVerifier && recaptchaContainerId === containerId) {
    debugLog.info('mfa', 'Reusing recaptcha verifier', { containerId });
    return recaptchaVerifier;
  }

  clearRecaptchaVerifier();
  resetLoginRecaptchaForPhoneMfa();

  const container = document.getElementById(containerId);
  if (!container) {
    debugLog.error('mfa', 'Recaptcha container missing from DOM', { containerId });
    throw new Error('Verification UI failed to load. Refresh and try again.');
  }

  clearRecaptchaContainer(containerId);
  recaptchaContainerId = containerId;

  debugLog.info('mfa', 'Creating recaptcha verifier', {
    containerId,
    userAgent: navigator.userAgent,
  });

  recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, containerId, {
    size: 'invisible',
  });

  try {
    await recaptchaVerifier.render();
    debugLog.info('mfa', 'Recaptcha verifier rendered', { containerId });
  } catch (error) {
    debugLog.error('mfa', 'Recaptcha verifier render failed', {
      containerId,
      error: serializeError(error),
    });
    clearRecaptchaVerifier();
    throw error;
  }

  return recaptchaVerifier;
}

export async function sendMfaEnrollmentCode(
  user: User,
  phoneNumber: string,
  containerId: string,
): Promise<string> {
  const firebaseAuth = requireAuth();

  freeLocalStorageForAuth();

  let activeUser = firebaseAuth.currentUser ?? user;
  if (!activeUser) {
    throw new Error('You must be signed in to verify your phone number');
  }

  const recaptchaDisabled = isRecaptchaDisabled();
  const mfaEnrolled = isMfaEnrolled(activeUser);

  debugLog.info('mfa', 'Sending MFA enrollment code', {
    uid: activeUser.uid,
    phoneE164: phoneNumber,
    phoneMasked: maskPhoneNumber(phoneNumber),
    containerId,
    emailVerified: activeUser.emailVerified,
    isPasswordUser: isPasswordAuthUser(activeUser),
    mfaEnrolled,
    recaptchaDisabled,
    usingCurrentUser: activeUser === firebaseAuth.currentUser,
  });

  let step = 'refreshIdToken';

  try {
    debugLog.debug('mfa', 'MFA enrollment step: refreshIdToken', { uid: activeUser.uid });
    await activeUser.getIdToken(true);
    activeUser = firebaseAuth.currentUser ?? activeUser;
    const tokenClaims = await readIdTokenClaims(activeUser);
    const tokenAgeSeconds = tokenClaims?.auth_time
      ? Math.floor(Date.now() / 1000) - tokenClaims.auth_time
      : null;
    debugLog.info('mfa', 'MFA enrollment ID token refreshed', {
      uid: activeUser.uid,
      emailVerified: activeUser.emailVerified,
      tokenEmailVerified: tokenClaims?.email_verified ?? null,
      tokenAuthTime: tokenClaims?.auth_time ?? null,
      tokenAgeSeconds,
    });

    if (isPasswordAuthUser(activeUser)) {
      const emailVerifiedInToken = tokenClaims?.email_verified === true;
      if (!activeUser.emailVerified || !emailVerifiedInToken) {
        debugLog.warn('mfa', 'MFA enrollment blocked: email not verified', {
          uid: activeUser.uid,
          email: activeUser.email,
          userEmailVerified: activeUser.emailVerified,
          tokenEmailVerified: tokenClaims?.email_verified ?? null,
        });
        throw Object.assign(new Error('Firebase: Error (auth/unverified-email).'), {
          code: 'auth/unverified-email',
        });
      }
    }

    step = 'getSession';
    debugLog.debug('mfa', 'MFA enrollment step: getSession', { uid: activeUser.uid });
    let session;
    try {
      session = await multiFactor(activeUser).getSession();
    } catch (sessionError) {
      const sessionCode = getAuthErrorCode(sessionError);
      debugLog.warn('mfa', 'MFA enrollment getSession failed', {
        uid: activeUser.uid,
        errorCode: sessionCode,
        error: serializeError(sessionError),
        willRetryAfterTokenRefresh: sessionCode === 'auth/internal-error',
      });

      if (sessionCode === 'auth/internal-error') {
        await activeUser.getIdToken(true);
        activeUser = firebaseAuth.currentUser ?? activeUser;
        session = await multiFactor(activeUser).getSession();
      } else {
        throw sessionError;
      }
    }
    debugLog.info('mfa', 'MFA enrollment session acquired', { uid: activeUser.uid });

    step = 'recaptcha';
    debugLog.debug('mfa', 'MFA enrollment step: recaptcha', { recaptchaDisabled, containerId });
    const verifier = await getRecaptchaVerifier(containerId);

    step = 'verifyPhoneNumber';
    debugLog.debug('mfa', 'MFA enrollment step: verifyPhoneNumber', {
      phoneE164: phoneNumber,
      phoneMasked: maskPhoneNumber(phoneNumber),
    });
    const phoneAuthProvider = new PhoneAuthProvider(firebaseAuth);
    const verificationId = await phoneAuthProvider.verifyPhoneNumber(
      { phoneNumber, session },
      verifier,
    );

    debugLog.info('mfa', 'MFA enrollment SMS requested', {
      phoneE164: phoneNumber,
      phoneMasked: maskPhoneNumber(phoneNumber),
      verificationIdPrefix: verificationId.slice(0, 8),
    });

    return verificationId;
  } catch (error) {
    const errorCode = getAuthErrorCode(error);
    debugLog.error('mfa', 'MFA enrollment SMS failed', {
      phoneE164: phoneNumber,
      phoneMasked: maskPhoneNumber(phoneNumber),
      step,
      emailVerified: activeUser.emailVerified,
      isPasswordUser: isPasswordAuthUser(activeUser),
      mfaEnrolled: isMfaEnrolled(activeUser),
      recaptchaDisabled,
      errorCode: errorCode ?? 'unknown',
      error: serializeError(error),
      firebaseConsoleHint:
        errorCode === 'auth/operation-not-allowed'
          ? 'Enable SMS Multi-factor Authentication in Firebase Console (Authentication → Sign-in method → Advanced)'
          : undefined,
    });
    throw normalizeMfaSendError(error, step);
  }
}

export async function enrollSmsMfa(
  user: User,
  verificationId: string,
  verificationCode: string,
): Promise<User> {
  const firebaseAuth = requireAuth();
  let activeUser = firebaseAuth.currentUser ?? user;
  if (!activeUser) {
    throw new Error('You must be signed in to verify your phone number');
  }

  let step = 'confirmCode';

  debugLog.info('mfa', 'Enrolling SMS MFA factor', {
    uid: activeUser.uid,
    verificationIdPrefix: verificationId.slice(0, 8),
  });

  try {
    debugLog.debug('mfa', 'MFA enrollment step: confirmCode', {
      uid: activeUser.uid,
      verificationIdPrefix: verificationId.slice(0, 8),
    });

    step = 'refreshIdToken';
    debugLog.debug('mfa', 'MFA enrollment step: refreshIdToken', { uid: activeUser.uid });
    await activeUser.getIdToken(true);
    activeUser = firebaseAuth.currentUser ?? activeUser;

    step = 'enroll';
    debugLog.debug('mfa', 'MFA enrollment step: enroll', { uid: activeUser.uid });
    const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
    const assertion = PhoneMultiFactorGenerator.assertion(credential);

    try {
      await multiFactor(activeUser).enroll(assertion, 'Personal phone');
    } catch (enrollError) {
      const enrollCode = getAuthErrorCode(enrollError);
      debugLog.warn('mfa', 'MFA enrollment enroll failed', {
        uid: activeUser.uid,
        errorCode: enrollCode,
        error: serializeError(enrollError),
        willRetryAfterTokenRefresh: enrollCode === 'auth/internal-error',
      });

      if (enrollCode === 'auth/internal-error') {
        await activeUser.getIdToken(true);
        activeUser = firebaseAuth.currentUser ?? activeUser;
        await multiFactor(activeUser).enroll(assertion, 'Personal phone');
      } else {
        throw enrollError;
      }
    }

    clearRecaptchaVerifier();
    clearPersistedMfaEnrollmentState();
    debugLog.info('mfa', 'SMS MFA enrollment succeeded', { uid: activeUser.uid });

    if (isPasswordAuthUser(activeUser)) {
      step = 'finalizePasswordAccountSetup';
      debugLog.debug('mfa', 'MFA enrollment step: finalizePasswordAccountSetup', {
        uid: activeUser.uid,
      });
      const { finalizePasswordAccountSetup } = await import('@/common/services/users');
      await withFirestoreRetry(
        () => finalizePasswordAccountSetup(activeUser.uid),
        activeUser,
      );
      debugLog.info('mfa', 'Password account setup finalized in Firestore', { uid: activeUser.uid });
    }

    const { reloadCurrentUser } = await import('@/features/auth/services/auth');
    const refreshedUser = await reloadCurrentUser(activeUser);
    debugLog.info('mfa', 'MFA enrollment state synced to session', {
      uid: refreshedUser.uid,
      enrolledFactorCount: multiFactor(refreshedUser).enrolledFactors.length,
    });
    return refreshedUser;
  } catch (error) {
    debugLog.error('mfa', 'SMS MFA enrollment failed', {
      step,
      uid: activeUser.uid,
      errorCode: getAuthErrorCode(error),
      error: serializeError(error),
    });
    throw attachMfaStep(error, step);
  }
}

export async function unenrollAllSmsMfa(user: User): Promise<void> {
  const enrolled = [...multiFactor(user).enrolledFactors];
  if (enrolled.length === 0) {
    return;
  }

  debugLog.info('mfa', 'Unenrolling all SMS MFA factors', {
    uid: user.uid,
    factorCount: enrolled.length,
  });

  for (const factor of enrolled) {
    try {
      await multiFactor(user).unenroll(factor);
      debugLog.info('mfa', 'Unenrolled MFA factor', {
        uid: user.uid,
        factorUid: factor.uid,
      });
    } catch (error) {
      const code = getAuthErrorCode(error);
      debugLog.warn('mfa', 'MFA factor unenroll failed', {
        uid: user.uid,
        factorUid: factor.uid,
        errorCode: code,
        error: serializeError(error),
      });

      if (code !== 'auth/internal-error') {
        throw error;
      }
    }
  }
}

export async function sendMfaSignInCode(containerId: string): Promise<string> {
  const firebaseAuth = requireAuth();
  const resolver = pendingResolver;
  if (!resolver) {
    throw new Error('No MFA sign-in in progress');
  }

  freeLocalStorageForAuth();

  const phoneHint = resolver.hints.find(
    (hint) => hint.factorId === PhoneMultiFactorGenerator.FACTOR_ID,
  );
  if (!phoneHint) {
    throw new Error('No phone factor is enrolled for this account');
  }

  const reusingVerifier = Boolean(recaptchaVerifier && recaptchaContainerId === containerId);
  debugLog.info('mfa', 'Sending MFA sign-in code', { containerId, reusingVerifier });

  let step = 'recaptcha';

  try {
    const verifier = await getRecaptchaVerifier(containerId, { reuse: reusingVerifier });

    step = 'verifyPhoneNumber';
    const phoneAuthProvider = new PhoneAuthProvider(firebaseAuth);
    const verificationId = await phoneAuthProvider.verifyPhoneNumber(
      { multiFactorHint: phoneHint, session: resolver.session },
      verifier,
    );

    debugLog.info('mfa', 'MFA sign-in SMS requested', {
      verificationIdPrefix: verificationId.slice(0, 8),
      reusingVerifier,
    });
    return verificationId;
  } catch (error) {
    debugLog.error('mfa', 'MFA sign-in SMS failed', {
      step,
      reusingVerifier,
      errorCode: getAuthErrorCode(error),
      error: serializeError(error),
    });
    throw normalizeMfaSendError(error, step);
  }
}

export async function completeMfaSignIn(
  verificationId: string,
  verificationCode: string,
): Promise<User> {
  const resolver = pendingResolver;
  if (!resolver) {
    throw new Error('No MFA sign-in in progress');
  }

  const started = Date.now();
  let step = 'resolveSignIn';

  debugLog.info('mfa', 'Completing MFA sign-in', {
    verificationIdPrefix: verificationId.slice(0, 8),
  });

  try {
    debugLog.debug('mfa', 'MFA sign-in step: resolveSignIn', { elapsedMs: Date.now() - started });
    const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
    const assertion = PhoneMultiFactorGenerator.assertion(credential);
    const result = await resolver.resolveSignIn(assertion);
    pendingResolver = null;
    clearRecaptchaVerifier();
    debugLog.info('mfa', 'MFA sign-in step: resolveSignIn complete', {
      uid: result.user.uid,
      elapsedMs: Date.now() - started,
    });

    const { reloadCurrentUser, setPostAuthBypass, syncAuthSessionAfterSignIn } = await import(
      '@/features/auth/services/auth'
    );
    setPostAuthBypass(result.user.uid);

    step = 'reloadUser';
    debugLog.debug('mfa', 'MFA sign-in step: reloadUser', {
      uid: result.user.uid,
      elapsedMs: Date.now() - started,
    });
    let activeUser = result.user;
    try {
      activeUser = await reloadCurrentUser(result.user);
    } catch (reloadError) {
      const reloadCode = getAuthErrorCode(reloadError);
      debugLog.warn('mfa', 'MFA sign-in reloadUser failed, attempting session sync fallback', {
        uid: result.user.uid,
        errorCode: reloadCode,
        error: serializeError(reloadError),
        elapsedMs: Date.now() - started,
      });

      try {
        activeUser = await syncAuthSessionAfterSignIn(result.user, 'mfa-sign-in');
      } catch (syncError) {
        debugLog.error('mfa', 'MFA sign-in session sync fallback failed', {
          uid: result.user.uid,
          errorCode: getAuthErrorCode(syncError),
          error: serializeError(syncError),
          elapsedMs: Date.now() - started,
        });
        throw attachMfaStep(reloadError, step);
      }
    }

    debugLog.info('mfa', 'MFA sign-in succeeded', {
      uid: activeUser.uid,
      enrolledFactorCount: multiFactor(activeUser).enrolledFactors.length,
      elapsedMs: Date.now() - started,
    });
    return activeUser;
  } catch (error) {
    debugLog.error('mfa', 'MFA sign-in failed', {
      step,
      errorCode: getAuthErrorCode(error),
      error: serializeError(error),
      elapsedMs: Date.now() - started,
    });
    throw attachMfaStep(error, step);
  }
}

export function getMaskedPhoneHint(): string | null {
  const resolver = pendingResolver;
  if (!resolver) {
    return null;
  }

  const phoneHint = resolver.hints.find(
    (hint) => hint.factorId === PhoneMultiFactorGenerator.FACTOR_ID,
  );
  if (!phoneHint || !('phoneNumber' in phoneHint)) {
    return null;
  }

  return String(phoneHint.phoneNumber);
}
