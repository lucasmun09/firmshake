export type AuthErrorContext = 'login' | 'register' | 'google';

const LOGIN_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-not-found': "We couldn't find an account with that email.",
  'auth/wrong-password': 'Incorrect password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Connection problem. Check your internet and try again.',
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
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email. Try signing in with email and password.',
  'auth/credential-already-in-use': 'This Google account is already linked to another user.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Connection problem. Check your internet and try again.',
};

const DEFAULT_MESSAGES: Record<AuthErrorContext, string> = {
  login: 'Issues logging in. Please try later.',
  register: 'Issues creating your account. Please try later.',
  google: 'Issues signing in with Google. Please try later.',
};

function getAuthErrorCode(error: unknown): string | null {
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

  if (!code) {
    return DEFAULT_MESSAGES[context];
  }

  const messages =
    context === 'register'
      ? REGISTER_MESSAGES
      : context === 'google'
        ? GOOGLE_MESSAGES
        : LOGIN_MESSAGES;

  return messages[code] ?? DEFAULT_MESSAGES[context];
}
