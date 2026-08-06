import { debugLog, serializeError } from '@/common/debug/debugLog';

export type AuthErrorContext = 'login' | 'register' | 'google';
export type PasswordResetErrorContext = 'request' | 'verify' | 'update';

const LOGIN_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-not-found': "We couldn't find an account with that email.",
  'auth/wrong-password': 'Incorrect password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Connection problem. Check your internet and try again.',
  'auth/multi-factor-auth-required': 'SMS verification is required to finish signing in.',
};

const REGISTER_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/operation-not-allowed': 'Email sign-up is not available right now.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Connection problem. Check your internet and try again.',
};

const GOOGLE_MESSAGES: Record<string, string> = {
  'auth/account-exists-with-different-credential':
    'An account already exists with this email. Try signing in with email and password.',
  'auth/credential-already-in-use': 'This Google account is already linked to another user.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Connection problem. Check your internet and try again.',
};

const FIRESTORE_MESSAGES: Record<string, string> = {
  'permission-denied':
    'Could not load your account data. Refresh the page and try again.',
};

const DEFAULT_MESSAGES: Record<AuthErrorContext, string> = {
  login: 'Issues logging in. Please try later.',
  register: 'Issues creating your account. Please try later.',
  google: 'Issues signing in with Google. Please try later.',
};

const MFA_MESSAGES: Record<string, string> = {
  'auth/unverified-email': 'Verify your email address before verifying your phone number.',
  'auth/operation-not-allowed':
    "SMS verification is not enabled. Ask an admin to enable SMS Multi-factor Authentication in Firebase.",
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/captcha-check-failed': 'Security check failed. Refresh the page and try again.',
  'auth/internal-error': "We couldn't verify your request. Please try again.",
  'auth/invalid-app-credential':
    'SMS verification is not configured correctly. Confirm SMS MFA and reCAPTCHA are enabled in Firebase.',
  'auth/missing-recaptcha-token': 'Security check failed. Refresh the page and try again.',
  'auth/invalid-recaptcha-token': 'Security check failed. Refresh the page and try again.',
  'auth/invalid-verification-code': 'That code is incorrect. Please try again.',
  'auth/code-expired': 'That code has expired. Request a new one.',
  'auth/network-request-failed': 'Connection problem. Check your internet and try again.',
  'auth/quota-exceeded': "We couldn't send a verification code right now. Please try again later.",
  'auth/missing-phone-number': 'Please enter a valid phone number.',
  'auth/user-token-expired': 'Your session expired. Sign in again and retry.',
  'auth/requires-recent-login':
    'For security, sign out, sign in again with your password, then retry phone verification.',
};

const MFA_STEP_MESSAGES: Record<string, Partial<Record<string, string>>> = {
  getSession: {
    'auth/internal-error':
      'Could not prepare phone verification. Sign out, sign in again, then retry. If this continues, confirm SMS MFA is enabled in Firebase.',
  },
  recaptcha: {
    'auth/internal-error': 'Security check failed to load. Refresh the page and try again.',
    'auth/captcha-check-failed': 'Security check failed. Refresh the page and try again.',
  },
  verifyPhoneNumber: {
    'auth/internal-error': 'Could not send the verification text. Refresh the page and try again.',
    'auth/captcha-check-failed': 'Security check failed. Refresh the page and try again.',
  },
  enroll: {
    'auth/internal-error':
      'Could not finish phone verification. Refresh the page and enter the code again, or request a new code.',
    'auth/invalid-verification-code': 'That code is incorrect. Please try again.',
    'auth/code-expired': 'That code has expired. Request a new one.',
  },
  resolveSignIn: {
    'auth/internal-error':
      'Could not finish sign-in verification. Refresh the page and enter the code again, or request a new code.',
    'auth/invalid-verification-code': 'That code is incorrect. Please try again.',
    'auth/code-expired': 'That code has expired. Request a new one.',
    'permission-denied':
      'Sign-in verified, but we could not load your account. Refresh the page and try again.',
  },
  reloadUser: {
    'auth/internal-error':
      'Sign-in is taking longer than expected. Continuing automatically...',
    'permission-denied':
      'Sign-in verified. Loading your account...',
  },
  finalizePasswordAccountSetup: {
    'permission-denied':
      'Phone verified, but we could not finish account setup. Refresh the page and try again.',
  },
};

const DEFAULT_MFA_MESSAGE = 'Phone verification failed. Please try again.';

const START_OVER_MESSAGES: Record<string, string> = {
  'permission-denied':
    'We could not remove your saved profile. Sign out, wait a moment, and try Start over again.',
  'auth/requires-recent-login': 'For security, sign in again before starting over.',
  'auth/internal-error':
    'We could not fully delete your account. Sign out, wait a minute, and try registering again. If the email is still blocked, contact support.',
  'auth/network-request-failed':
    'Connection problem while deleting your account. Check your internet and try again.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/user-token-expired': 'Your session expired. Sign in again and retry Start over.',
};

const DEFAULT_START_OVER_MESSAGE =
  'We could not reset your registration. Sign out and try again, or contact support.';

const PASSWORD_RESET_REQUEST_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-not-found': 'If an account exists for this email, we sent a verification link.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Connection problem. Check your internet and try again.',
  'auth/operation-not-allowed':
    'Email link sign-in is not enabled. Ask an admin to enable Email link under Email/Password in Firebase.',
};

const PASSWORD_RESET_VERIFY_MESSAGES: Record<string, string> = {
  'auth/invalid-action-code':
    'This reset link is invalid, expired, or was already used. Request a new link from the forgot password page.',
  'auth/expired-action-code': 'This reset link has expired. Request a new one.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/invalid-credential':
    'That email does not match this reset link. Enter the same email address that received the link.',
  'auth/missing-email':
    'Enter the email address that received the reset link. If you requested the link on another device or browser, you must type your email here.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/account-exists-with-different-credential':
    'This account uses Google sign-in. Sign in with Google instead.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Connection problem. Check your internet and try again.',
};

const PASSWORD_RESET_UPDATE_MESSAGES: Record<string, string> = {
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/requires-recent-login':
    'For security, open the reset link again and complete verification before updating your password.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Connection problem. Check your internet and try again.',
};

const DEFAULT_PASSWORD_RESET_MESSAGES: Record<PasswordResetErrorContext, string> = {
  request: 'Could not send a reset link. Please try again.',
  verify: 'Could not verify your reset link. Request a new one and try again.',
  update: 'Could not update your password. Please try again.',
};

export function getAuthErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === 'string' ? code : null;
  }

  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/auth\/[a-z0-9-]+/);
  return match?.[0] ?? null;
}

export function formatAuthError(error: unknown, context: AuthErrorContext = 'login'): string {
  const code = getAuthErrorCode(error);

  if (code && FIRESTORE_MESSAGES[code]) {
    return FIRESTORE_MESSAGES[code];
  }

  if (code) {
    const messages =
      context === 'register'
        ? REGISTER_MESSAGES
        : context === 'google'
          ? GOOGLE_MESSAGES
          : LOGIN_MESSAGES;

    if (messages[code]) {
      return messages[code];
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return DEFAULT_MESSAGES[context];
}

function getMfaStep(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'mfaStep' in error) {
    const step = (error as { mfaStep: unknown }).mfaStep;
    return typeof step === 'string' ? step : null;
  }
  return null;
}

function logMfaError(error: unknown, code: string | null, step: string | null): void {
  debugLog.error('mfa', 'MFA error surfaced to user', {
    code: code ?? 'unknown',
    step: step ?? 'unknown',
    error: serializeError(error),
  });
}

export function formatMfaError(
  error: unknown,
  options?: { invalidPhoneMessage?: string },
): string {
  const code = getAuthErrorCode(error);
  const step = getMfaStep(error);

  if (code === 'auth/invalid-phone-number' && options?.invalidPhoneMessage) {
    return options.invalidPhoneMessage;
  }

  if (code && step && MFA_STEP_MESSAGES[step]?.[code]) {
    return MFA_STEP_MESSAGES[step][code]!;
  }

  if (code && FIRESTORE_MESSAGES[code]) {
    return FIRESTORE_MESSAGES[code];
  }

  if (code && MFA_MESSAGES[code]) {
    return MFA_MESSAGES[code];
  }

  logMfaError(error, code, step);
  return DEFAULT_MFA_MESSAGE;
}

export function formatPasswordResetError(
  error: unknown,
  context: PasswordResetErrorContext,
): string {
  if (error instanceof Error && error.message.trim() && !getAuthErrorCode(error)) {
    return error.message;
  }

  const code = getAuthErrorCode(error);

  if (code && FIRESTORE_MESSAGES[code]) {
    return FIRESTORE_MESSAGES[code];
  }

  const messages =
    context === 'request'
      ? PASSWORD_RESET_REQUEST_MESSAGES
      : context === 'verify'
        ? PASSWORD_RESET_VERIFY_MESSAGES
        : PASSWORD_RESET_UPDATE_MESSAGES;

  if (code && messages[code]) {
    return messages[code];
  }

  if (code && MFA_MESSAGES[code]) {
    return MFA_MESSAGES[code];
  }

  debugLog.error('auth', 'Password reset error surfaced to user', {
    context,
    code: code ?? 'unknown',
    error: serializeError(error),
  });

  return DEFAULT_PASSWORD_RESET_MESSAGES[context];
}

export function formatStartOverError(error: unknown): string {
  if (error instanceof Error && error.message.trim() && !getAuthErrorCode(error)) {
    return error.message;
  }

  const code = getAuthErrorCode(error);

  if (code && START_OVER_MESSAGES[code]) {
    return START_OVER_MESSAGES[code];
  }

  if (code && FIRESTORE_MESSAGES[code]) {
    return FIRESTORE_MESSAGES[code];
  }

  debugLog.error('auth', 'Start over error surfaced to user', {
    code: code ?? 'unknown',
    error: serializeError(error),
  });

  return DEFAULT_START_OVER_MESSAGE;
}

export function shouldShowMfaSetupHelp(error: unknown): boolean {
  return import.meta.env.DEV && getAuthErrorCode(error) === 'auth/operation-not-allowed';
}
