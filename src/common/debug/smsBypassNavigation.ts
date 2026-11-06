/**
 * Where (if anywhere) Bypass SMS may navigate after enabling the deovo flag.
 *
 * `/mfa-challenge` means Firebase Auth still needs a second-factor SMS code.
 * The deovo bypass only skips *enrollment* redirects — it cannot complete a
 * pending multi-factor sign-in. Navigating away leaves `currentUser` null and
 * looks like a failed login.
 */
export function resolveSmsBypassNavigation(
  path: string,
  hasSignedInUser: boolean,
): '/tabs/home' | null {
  if (path === '/mfa-challenge') {
    return null;
  }

  if (path === '/mfa-enroll' && hasSignedInUser) {
    return '/tabs/home';
  }

  return null;
}

export type SmsBypassToastKind =
  | 'enrollment-finalized'
  | 'enrollment-finalize-failed'
  | 'flag-only'
  | 'challenge-blocked';

export function resolveSmsBypassToastKind(input: {
  path: string;
  accountSetupFinalized: boolean;
  uid: string | null;
}): SmsBypassToastKind {
  if (input.path === '/mfa-challenge') {
    return 'challenge-blocked';
  }
  if (input.accountSetupFinalized) {
    return 'enrollment-finalized';
  }
  if (input.uid) {
    return 'enrollment-finalize-failed';
  }
  return 'flag-only';
}

export function smsBypassToastMessage(kind: SmsBypassToastKind): {
  message: string;
  color: 'success' | 'warning' | 'danger' | 'medium';
} {
  switch (kind) {
    case 'challenge-blocked':
      return {
        message:
          'Bypass cannot skip the login SMS code. Enter the code sent to your phone (or a Firebase test number). Leaving this page signs you out.',
        color: 'warning',
      };
    case 'enrollment-finalized':
      return {
        message: 'SMS enrollment bypassed. Account setup marked complete.',
        color: 'success',
      };
    case 'enrollment-finalize-failed':
      return {
        message:
          'SMS bypass flag set. Could not finalize account setup — try again after signing in.',
        color: 'warning',
      };
    case 'flag-only':
      return {
        message: 'SMS bypass enabled for this device. Sign in / register to skip enrollment.',
        color: 'success',
      };
  }
}
