import { describe, expect, it } from 'vitest';

import { formatAuthError, formatMfaError, formatStartOverError, shouldShowMfaSetupHelp } from '@/features/auth/utils/authErrors';

describe('formatAuthError', () => {
  it('maps firestore permission-denied to a helpful message', () => {
    expect(formatAuthError({ code: 'permission-denied' }, 'google')).toBe(
      'Could not load your account data. Refresh the page and try again.',
    );
  });

  it('surfaces plain Error messages such as reCAPTCHA failures', () => {
    expect(formatAuthError(new Error('reCAPTCHA score too low'), 'login')).toBe(
      'reCAPTCHA score too low',
    );
  });

  it('maps firebase auth codes', () => {
    expect(
      formatAuthError({ code: 'auth/wrong-password' }, 'login'),
    ).toBe('Incorrect password.');
  });
});

describe('formatMfaError', () => {
  it('maps operation-not-allowed to a setup message', () => {
    expect(formatMfaError({ code: 'auth/operation-not-allowed' })).toBe(
      'SMS verification is not enabled. Ask an admin to enable SMS Multi-factor Authentication in Firebase.',
    );
  });

  it('maps internal-error at getSession to an actionable message', () => {
    expect(formatMfaError({ code: 'auth/internal-error', mfaStep: 'getSession' })).toBe(
      'Could not prepare phone verification. Sign out, sign in again, then retry. If this continues, confirm SMS MFA is enabled in Firebase.',
    );
  });

  it('maps internal-error at enroll to an actionable message', () => {
    expect(formatMfaError({ code: 'auth/internal-error', mfaStep: 'enroll' })).toBe(
      'Could not finish phone verification. Refresh the page and enter the code again, or request a new code.',
    );
  });

  it('maps internal-error without step to a generic message', () => {
    expect(formatMfaError({ code: 'auth/internal-error' })).toBe(
      "We couldn't verify your request. Please try again.",
    );
  });

  it('maps requires-recent-login to a sign-in-again message', () => {
    expect(formatMfaError({ code: 'auth/requires-recent-login', mfaStep: 'verifyPhoneNumber' })).toBe(
      'For security, sign out, sign in again with your password, then retry phone verification.',
    );
  });

  it('uses a custom invalid phone message', () => {
    expect(
      formatMfaError(
        { code: 'auth/invalid-phone-number' },
        { invalidPhoneMessage: 'Enter a valid US phone number.' },
      ),
    ).toBe('Enter a valid US phone number.');
  });

  it('falls back to a generic message for unknown errors', () => {
    expect(formatMfaError(new Error('Something unexpected happened'))).toBe(
      'Phone verification failed. Please try again.',
    );
  });

  it('maps localStorage quota errors to a friendly resend message', () => {
    expect(
      formatMfaError(
        Object.assign(new Error('QuotaExceededError'), {
          code: 'firmshake/storage-quota-exceeded',
          mfaStep: 'verifyPhoneNumber',
        }),
      ),
    ).toBe("We couldn't send a new code right now. Please try again or sign in again.");
  });

  it('maps DOMException quota errors without auth codes', () => {
    expect(
      formatMfaError(new DOMException('quota', 'QuotaExceededError')),
    ).toBe("We couldn't send a new code right now. Please try again or sign in again.");
  });

  it('maps resend failures at verifyPhoneNumber step', () => {
    expect(formatMfaError({ code: 'auth/too-many-requests', mfaStep: 'verifyPhoneNumber' })).toBe(
      'Too many code requests. Wait a few minutes and try again.',
    );
    expect(formatMfaError({ code: 'auth/session-expired', mfaStep: 'verifyPhoneNumber' })).toBe(
      'Your sign-in session expired. Go back to sign in and try again.',
    );
  });

  it('maps recaptcha failures at recaptcha step', () => {
    expect(formatMfaError({ code: 'auth/captcha-check-failed', mfaStep: 'recaptcha' })).toBe(
      'Security check failed. Refresh the page and try again.',
    );
  });
});

describe('formatStartOverError', () => {
  it('surfaces plain Error messages from abandonIncompleteRegistration', () => {
    expect(formatStartOverError(new Error('This account is already set up. Sign out to use a different account.'))).toBe(
      'This account is already set up. Sign out to use a different account.',
    );
  });

  it('maps permission-denied to a profile cleanup message', () => {
    expect(formatStartOverError({ code: 'permission-denied' })).toBe(
      'We could not remove your saved profile. Sign out, wait a moment, and try Start over again.',
    );
  });

  it('maps internal-error to an actionable start-over message', () => {
    expect(formatStartOverError({ code: 'auth/internal-error' })).toBe(
      'We could not fully delete your account. Sign out, wait a minute, and try registering again. If the email is still blocked, contact support.',
    );
  });
});

describe('shouldShowMfaSetupHelp', () => {
  it('only shows setup help for operation-not-allowed in dev builds', () => {
    expect(shouldShowMfaSetupHelp({ code: 'auth/operation-not-allowed' })).toBe(
      import.meta.env.DEV,
    );
    expect(shouldShowMfaSetupHelp({ code: 'auth/too-many-requests' })).toBe(false);
  });
});
