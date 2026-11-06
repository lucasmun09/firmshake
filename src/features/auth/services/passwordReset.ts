import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth';

import { debugLog, serializeError } from '@/common/debug/debugLog';
import { auth } from '@/common/services/firebase';
import { assertRecaptchaVerified } from '@/common/services/recaptchaGate';
import {
  captureMultiFactorResolver,
  isPasswordAuthUser,
} from '@/features/auth/services/mfa';
import { getAuthErrorCode } from '@/features/auth/utils/authErrors';

export const PASSWORD_MIN_LENGTH = 6;

/** Same-device email storage pattern as Firebase email link auth docs (`emailForSignIn`). */
const EMAIL_FOR_SIGN_IN_KEY = 'firmshake.emailForPasswordReset';
const PASSWORD_RESET_PENDING_KEY = 'firmshake.passwordResetPending';

export function getPasswordResetContinueUrl(): string {
  if (typeof window === 'undefined') {
    return '/reset-password';
  }

  return `${window.location.origin}/reset-password`;
}

export function markPasswordResetPending(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(PASSWORD_RESET_PENDING_KEY, '1');
  }
}

export function isPasswordResetFlowActive(): boolean {
  if (typeof sessionStorage === 'undefined') {
    return false;
  }

  return sessionStorage.getItem(PASSWORD_RESET_PENDING_KEY) === '1';
}

export function clearStoredPasswordResetEmail(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
  }
}

export function clearPasswordResetFlow(): void {
  clearStoredPasswordResetEmail();

  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(PASSWORD_RESET_PENDING_KEY);
  }
}

export function storePasswordResetEmail(email: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email.trim().toLowerCase());
}

export function readStoredPasswordResetEmail(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY)?.trim().toLowerCase() ?? null;
}

/** Resolve email for `signInWithEmailLink` (stored same-device email or manual entry). */
export function resolveEmailForPasswordResetLink(emailOverride?: string): string | null {
  const override = emailOverride?.trim().toLowerCase();
  if (override) {
    return override;
  }

  return readStoredPasswordResetEmail();
}

export function isPasswordResetEmailLink(link: string): boolean {
  if (!auth) {
    return false;
  }

  return isSignInWithEmailLink(auth, link);
}

export function validateNewPassword(password: string, confirmPassword: string): string | null {
  const trimmed = password.trim();
  const trimmedConfirm = confirmPassword.trim();

  if (trimmed.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  if (trimmed !== trimmedConfirm) {
    return 'Passwords do not match.';
  }

  return null;
}

export async function sendPasswordResetVerificationEmail(email: string): Promise<void> {
  if (!auth) {
    throw new Error('Firebase is not configured. Add credentials to .env.local');
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Please enter your email address.');
  }

  await assertRecaptchaVerified('password_reset');

  debugLog.info('auth', 'Sending password reset verification link', { email: normalizedEmail });

  await sendSignInLinkToEmail(auth, normalizedEmail, {
    url: getPasswordResetContinueUrl(),
    handleCodeInApp: true,
  });

  storePasswordResetEmail(normalizedEmail);
  markPasswordResetPending();
}

export async function completePasswordResetEmailLink(
  link: string,
  emailOverride?: string,
): Promise<User> {
  if (!auth) {
    throw new Error('Firebase is not configured. Add credentials to .env.local');
  }

  if (!isSignInWithEmailLink(auth, link)) {
    throw Object.assign(new Error('Firebase: Error (auth/invalid-action-code).'), {
      code: 'auth/invalid-action-code',
    });
  }

  const email = resolveEmailForPasswordResetLink(emailOverride);
  if (!email) {
    throw Object.assign(new Error('Firebase: Error (auth/missing-email).'), {
      code: 'auth/missing-email',
    });
  }

  markPasswordResetPending();

  debugLog.info('auth', 'Completing password reset email link sign-in', { email });

  try {
    const credential = await signInWithEmailLink(auth, email, link);
    // Per Firebase email link auth docs: clear stored email after successful sign-in.
    clearStoredPasswordResetEmail();

    if (!isPasswordAuthUser(credential.user)) {
      await signOut(auth);
      clearPasswordResetFlow();
      throw Object.assign(
        new Error('This account uses Google sign-in. Sign in with Google instead.'),
        { code: 'auth/account-exists-with-different-credential' },
      );
    }

    debugLog.info('auth', 'Password reset email link sign-in succeeded', {
      uid: credential.user.uid,
      email: credential.user.email,
    });
    return credential.user;
  } catch (err) {
    if (captureMultiFactorResolver(err)) {
      debugLog.info('auth', 'Password reset email link sign-in requires MFA');
      throw err;
    }

    debugLog.error('auth', 'Password reset email link sign-in failed', {
      email,
      errorCode: getAuthErrorCode(err),
      error: serializeError(err),
    });
    throw err;
  }
}

export async function finalizePasswordReset(newPassword: string): Promise<void> {
  if (!auth?.currentUser) {
    throw new Error('You must complete verification before setting a new password.');
  }

  const user = auth.currentUser;
  if (!isPasswordAuthUser(user)) {
    throw new Error('This account uses Google sign-in. Sign in with Google instead.');
  }

  debugLog.info('auth', 'Updating password after reset verification', { uid: user.uid });
  await updatePassword(user, newPassword);
  clearPasswordResetFlow();
  await signOut(auth);
  debugLog.info('auth', 'Password reset complete; signed out', { uid: user.uid });
}
