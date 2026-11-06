import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockVerifyPhoneNumber = vi.fn();
const mockRender = vi.fn().mockResolvedValue(undefined);
const mockClear = vi.fn();

vi.mock('firebase/auth', () => ({
  PhoneAuthProvider: vi.fn().mockImplementation(() => ({
    verifyPhoneNumber: mockVerifyPhoneNumber,
  })),
  PhoneMultiFactorGenerator: {
    FACTOR_ID: 'phone',
    assertion: vi.fn(),
  },
  RecaptchaVerifier: vi.fn().mockImplementation(() => ({
    render: mockRender,
    clear: mockClear,
  })),
  getMultiFactorResolver: vi.fn(),
  multiFactor: vi.fn((user: { __enrolledFactors?: unknown[] }) => ({
    enrolledFactors: user.__enrolledFactors ?? [],
  })),
}));

vi.mock('@/common/services/firebase', () => ({
  auth: { currentUser: null },
}));

vi.mock('@/common/services/firestoreAuth', () => ({
  withFirestoreRetry: vi.fn((fn: () => unknown) => fn()),
}));

vi.mock('@/utils/recaptcha', () => ({
  isRecaptchaDisabled: vi.fn(() => true),
  resetLoginRecaptchaForPhoneMfa: vi.fn(),
}));

describe('isPasswordAuthUser', () => {
  it('detects password and federated providers', async () => {
    const { isPasswordAuthUser } = await import('@/features/auth/services/mfa');

    expect(
      isPasswordAuthUser({
        providerData: [{ providerId: 'password' }],
      } as never),
    ).toBe(true);
    expect(
      isPasswordAuthUser({
        providerData: [{ providerId: 'google.com' }],
      } as never),
    ).toBe(false);
    expect(
      isPasswordAuthUser({
        providerData: [{ providerId: 'password' }, { providerId: 'google.com' }],
      } as never),
    ).toBe(true);
  });
});

describe('isMfaEnrolled', () => {
  it('returns true when any enrolled factor exists', async () => {
    const { isMfaEnrolled } = await import('@/features/auth/services/mfa');

    expect(
      isMfaEnrolled({
        uid: 'u1',
        __enrolledFactors: [{ factorId: 'phone' }],
      } as never),
    ).toBe(true);
    expect(
      isMfaEnrolled({
        uid: 'u1',
        __enrolledFactors: [],
      } as never),
    ).toBe(false);
  });
});

describe('MFA sign-in resend', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="mfa-challenge-recaptcha"></div>';
    mockVerifyPhoneNumber.mockResolvedValue('verification-id-123');

    const mfa = await import('@/features/auth/services/mfa');
    mfa.clearRecaptchaVerifier();
    mfa.setPendingMfaResolver({
      hints: [{ factorId: 'phone', phoneNumber: '+15555550526' }],
      session: { type: 'mock-session' },
      resolveSignIn: vi.fn(),
    } as never);
  });

  it('reuses the recaptcha verifier when resending a sign-in code', async () => {
    const { RecaptchaVerifier } = await import('firebase/auth');
    const { sendMfaSignInCode } = await import('@/features/auth/services/mfa');

    await sendMfaSignInCode('mfa-challenge-recaptcha');
    await sendMfaSignInCode('mfa-challenge-recaptcha');

    expect(RecaptchaVerifier).toHaveBeenCalledTimes(1);
    expect(mockVerifyPhoneNumber).toHaveBeenCalledTimes(2);
  });

  it('attaches verifyPhoneNumber step to resend failures', async () => {
    const { sendMfaSignInCode } = await import('@/features/auth/services/mfa');
    mockVerifyPhoneNumber.mockRejectedValueOnce({ code: 'auth/too-many-requests' });

    await expect(sendMfaSignInCode('mfa-challenge-recaptcha')).rejects.toMatchObject({
      code: 'auth/too-many-requests',
      mfaStep: 'verifyPhoneNumber',
    });
  });
});
