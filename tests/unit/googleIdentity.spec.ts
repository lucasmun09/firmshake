import { describe, expect, it } from 'vitest';

import {
  GoogleIdentityError,
  isGoogleIdentityRecoverable,
  isGoogleIdentityUserCancel,
  resolveGoogleSignInStrategy,
} from '@/features/auth/services/googleIdentity';

describe('resolveGoogleSignInStrategy', () => {
  it('uses redirect on Capacitor native', () => {
    expect(
      resolveGoogleSignInStrategy({
        isNativePlatform: true,
        hasGoogleWebClientId: true,
      }),
    ).toBe('redirect');
  });

  it('uses same-tab redirect on web when GIS is not configured', () => {
    expect(
      resolveGoogleSignInStrategy({
        isNativePlatform: false,
        hasGoogleWebClientId: false,
      }),
    ).toBe('redirect');
  });

  it('keeps same-tab redirect on web even when GIS client ID is configured', () => {
    // GIS is handled by GoogleSignInButton → loginWithGoogleIdToken, not this strategy.
    expect(
      resolveGoogleSignInStrategy({
        isNativePlatform: false,
        hasGoogleWebClientId: true,
      }),
    ).toBe('redirect');
  });

  it('allows popup only when explicitly enabled as fallback', () => {
    expect(
      resolveGoogleSignInStrategy({
        isNativePlatform: false,
        hasGoogleWebClientId: false,
        allowPopupFallback: true,
      }),
    ).toBe('popup');
  });
});

describe('Google Identity error helpers', () => {
  it('treats One Tap dismiss as user cancel', () => {
    const err = new GoogleIdentityError('gis/dismissed', 'dismissed');
    expect(isGoogleIdentityUserCancel(err)).toBe(true);
    expect(isGoogleIdentityRecoverable(err)).toBe(true);
  });

  it('does not treat skipped/not-displayed as user cancel so redirect can run', () => {
    expect(isGoogleIdentityUserCancel(new GoogleIdentityError('gis/skipped', 'skipped'))).toBe(false);
    expect(isGoogleIdentityUserCancel(new GoogleIdentityError('gis/not-displayed', 'missing'))).toBe(
      false,
    );
    expect(isGoogleIdentityRecoverable(new GoogleIdentityError('gis/not-displayed', 'missing'))).toBe(
      true,
    );
  });

  it('ignores non-GIS errors for cancel detection', () => {
    expect(isGoogleIdentityUserCancel(new Error('boom'))).toBe(false);
    expect(isGoogleIdentityRecoverable(new Error('boom'))).toBe(true);
  });
});
