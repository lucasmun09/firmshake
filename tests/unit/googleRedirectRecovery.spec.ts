import { describe, expect, it } from 'vitest';

import {
  GOOGLE_SIGN_IN_INCOMPLETE_MESSAGE,
  resolveGoogleRedirectOutcome,
  shouldAttemptGoogleRedirectRecovery,
} from '@/features/auth/services/googleRedirectRecovery';

describe('shouldAttemptGoogleRedirectRecovery', () => {
  it('attempts recovery when sessionStorage pending is set', () => {
    expect(
      shouldAttemptGoogleRedirectRecovery({
        hadSessionPending: true,
        hadLocalPending: false,
      }),
    ).toBe(true);
  });

  it('attempts recovery when only localStorage pending remains', () => {
    expect(
      shouldAttemptGoogleRedirectRecovery({
        hadSessionPending: false,
        hadLocalPending: true,
      }),
    ).toBe(true);
  });

  it('skips recovery when no pending markers exist', () => {
    expect(
      shouldAttemptGoogleRedirectRecovery({
        hadSessionPending: false,
        hadLocalPending: false,
      }),
    ).toBe(false);
  });
});

describe('resolveGoogleRedirectOutcome', () => {
  it('completes from getRedirectResult user when present', () => {
    expect(
      resolveGoogleRedirectOutcome({
        hadPending: true,
        hasResultUser: true,
        hasSessionUser: false,
      }),
    ).toBe('complete-from-result');
  });

  it('falls back to Firebase session when result is empty but pending', () => {
    expect(
      resolveGoogleRedirectOutcome({
        hadPending: true,
        hasResultUser: false,
        hasSessionUser: true,
      }),
    ).toBe('complete-from-session');
  });

  it('fails when pending exists but neither result nor session has a user', () => {
    expect(
      resolveGoogleRedirectOutcome({
        hadPending: true,
        hasResultUser: false,
        hasSessionUser: false,
      }),
    ).toBe('fail-incomplete');
  });

  it('is a noop on normal loads without pending', () => {
    expect(
      resolveGoogleRedirectOutcome({
        hadPending: false,
        hasResultUser: false,
        hasSessionUser: false,
      }),
    ).toBe('noop');
  });

  it('exposes the user-facing incomplete message constant', () => {
    expect(GOOGLE_SIGN_IN_INCOMPLETE_MESSAGE).toMatch(/did not complete/i);
  });
});
