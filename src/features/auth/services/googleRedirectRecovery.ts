/**
 * Pure helpers for Firebase Google `signInWithRedirect` boot recovery.
 * Keeps pending-flag / outcome decisions unit-testable without Firebase.
 */

export type GoogleRedirectOutcome =
  | 'complete-from-result'
  | 'complete-from-session'
  | 'fail-incomplete'
  | 'noop';

/**
 * Any pending marker (sessionStorage or still-valid localStorage) means we
 * should call `getRedirectResult` and attempt to finish sign-in.
 *
 * Do not treat local-only pending as "stale" — Safari / storage partitioning
 * can drop sessionStorage across the OAuth round-trip while localStorage survives.
 */
export function shouldAttemptGoogleRedirectRecovery(options: {
  hadSessionPending: boolean;
  hadLocalPending: boolean;
}): boolean {
  return options.hadSessionPending || options.hadLocalPending;
}

export function resolveGoogleRedirectOutcome(options: {
  hadPending: boolean;
  hasResultUser: boolean;
  hasSessionUser: boolean;
}): GoogleRedirectOutcome {
  if (options.hasResultUser) {
    return 'complete-from-result';
  }

  if (options.hasSessionUser && options.hadPending) {
    return 'complete-from-session';
  }

  if (options.hadPending) {
    return 'fail-incomplete';
  }

  return 'noop';
}

export const GOOGLE_SIGN_IN_INCOMPLETE_MESSAGE =
  'Google sign-in did not complete. Please try again or use email and password.';
