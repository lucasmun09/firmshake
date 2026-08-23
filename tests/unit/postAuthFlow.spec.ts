import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import type { UserProfile } from '@/types';

vi.mock('@/common/services/firebase', () => ({
  auth: { currentUser: null },
}));

vi.mock('@/common/debug/devoSmsBypass', () => ({
  isDevoSmsBypassEnabled: vi.fn(() => false),
}));

vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/auth')>();
  return {
    ...actual,
    multiFactor: vi.fn((user: { enrolledFactors?: unknown[] }) => ({
      enrolledFactors: (user as { __enrolledFactors?: unknown[] }).__enrolledFactors ?? [],
    })),
  };
});

function mockUser(overrides: {
  uid?: string;
  providers?: string[];
  enrolledFactors?: unknown[];
}): User {
  const providers = overrides.providers ?? ['password'];
  return {
    uid: overrides.uid ?? 'user-1',
    providerData: providers.map((providerId) => ({ providerId })),
    __enrolledFactors: overrides.enrolledFactors ?? [],
  } as unknown as User;
}

function mockProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    uid: 'user-1',
    email: 'user@example.com',
    displayName: 'Test User',
    firstName: 'Test',
    lastName: 'User',
    communityIds: ['all'],
    ...overrides,
  } as UserProfile;
}

describe('postAuthFlow MFA enrollment decisions', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { isDevoSmsBypassEnabled } = await import('@/common/debug/devoSmsBypass');
    vi.mocked(isDevoSmsBypassEnabled).mockReturnValue(false);
  });

  it('requires SMS MFA for incomplete email/password accounts', async () => {
    const { decideMfaEnrollment, needsMfaEnrollment, resolvePostAuthPath } = await import(
      '@/features/auth/services/postAuthFlow'
    );
    const user = mockUser({ providers: ['password'] });
    const profile = mockProfile({ accountSetupComplete: false });

    expect(decideMfaEnrollment(user, profile)).toEqual({
      required: true,
      reason: 'password-needs-sms',
    });
    expect(needsMfaEnrollment(user, profile)).toBe(true);
    expect(resolvePostAuthPath(user, profile)).toBe('/mfa-enroll');
  });

  it('skips SMS MFA for Google-only sign-in', async () => {
    const { decideMfaEnrollment, needsMfaEnrollment, resolvePostAuthPath } = await import(
      '@/features/auth/services/postAuthFlow'
    );
    const user = mockUser({ providers: ['google.com'] });
    const profile = mockProfile({
      authProvider: 'google.com',
      accountSetupComplete: true,
      profileComplete: true,
    });

    expect(decideMfaEnrollment(user, profile)).toEqual({
      required: false,
      reason: 'oauth-provider',
    });
    expect(needsMfaEnrollment(user, profile)).toBe(false);
    expect(resolvePostAuthPath(user, profile)).toBe('/tabs/home');
  });

  it('skips SMS MFA for other federated providers without password', async () => {
    const { decideMfaEnrollment } = await import('@/features/auth/services/postAuthFlow');
    const user = mockUser({ providers: ['apple.com'] });

    expect(decideMfaEnrollment(user, null)).toEqual({
      required: false,
      reason: 'oauth-provider',
    });
  });

  it('skips SMS MFA when any Firebase MFA factor is already enrolled', async () => {
    const { decideMfaEnrollment } = await import('@/features/auth/services/postAuthFlow');
    const user = mockUser({
      providers: ['password'],
      enrolledFactors: [{ factorId: 'phone' }],
    });

    expect(decideMfaEnrollment(user, mockProfile({ accountSetupComplete: false }))).toEqual({
      required: false,
      reason: 'already-enrolled',
    });
  });

  it('skips SMS MFA for password users after account setup is complete', async () => {
    const { decideMfaEnrollment } = await import('@/features/auth/services/postAuthFlow');
    const user = mockUser({ providers: ['password'] });

    expect(
      decideMfaEnrollment(user, mockProfile({ accountSetupComplete: true })),
    ).toEqual({
      required: false,
      reason: 'password-setup-complete',
    });
  });

  it('skips SMS MFA for control-panel test accounts', async () => {
    const { decideMfaEnrollment } = await import('@/features/auth/services/postAuthFlow');
    const user = mockUser({ providers: ['password'] });

    expect(
      decideMfaEnrollment(user, mockProfile({ isTestAccount: true, accountSetupComplete: false })),
    ).toEqual({
      required: false,
      reason: 'test-account',
    });
  });

  it('skips SMS MFA when deovo SMS bypass is enabled', async () => {
    const { isDevoSmsBypassEnabled } = await import('@/common/debug/devoSmsBypass');
    vi.mocked(isDevoSmsBypassEnabled).mockReturnValue(true);

    const { decideMfaEnrollment, needsMfaEnrollment, resolvePostAuthPath } = await import(
      '@/features/auth/services/postAuthFlow'
    );
    const user = mockUser({ providers: ['password'] });
    const profile = mockProfile({ accountSetupComplete: false });

    expect(decideMfaEnrollment(user, profile)).toEqual({
      required: false,
      reason: 'devo-sms-bypass',
    });
    expect(needsMfaEnrollment(user, profile)).toBe(false);
    expect(resolvePostAuthPath(user, profile)).toBe('/tabs/home');
  });

  it('still requires SMS when password is linked alongside Google', async () => {
    const { decideMfaEnrollment } = await import('@/features/auth/services/postAuthFlow');
    const user = mockUser({ providers: ['password', 'google.com'] });

    expect(decideMfaEnrollment(user, mockProfile({ accountSetupComplete: false }))).toEqual({
      required: true,
      reason: 'password-needs-sms',
    });
  });

  it('routes Google users with incomplete profile to complete-profile, not MFA', async () => {
    const { resolvePostAuthPath } = await import('@/features/auth/services/postAuthFlow');
    const user = mockUser({ providers: ['google.com'] });
    const profile = mockProfile({
      authProvider: 'google.com',
      profileComplete: false,
      firstName: '',
      lastName: '',
    });

    expect(resolvePostAuthPath(user, profile)).toBe('/complete-profile');
  });
});
