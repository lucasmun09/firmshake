import type { User } from 'firebase/auth';

import type { UserProfile } from '@/types';
import { debugLog } from '@/common/debug/debugLog';
import { isDevoSmsBypassEnabled } from '@/common/debug/devoSmsBypass';
import { isMfaEnrolled, isPasswordAuthUser } from '@/features/auth/services/mfa';

export function authProviderIds(user: User): string[] {
  return user.providerData.map((entry) => entry.providerId);
}

/** Google (or other federated OAuth) without a linked password credential. */
export function isExternalAuthUser(user: User): boolean {
  const providers = authProviderIds(user);
  return providers.includes('google.com') && !providers.includes('password');
}

export function needsProfileCompletion(profile: UserProfile | null, user: User): boolean {
  if (!isExternalAuthUser(user)) {
    return false;
  }

  if (profile?.profileComplete) {
    return false;
  }

  return !profile?.firstName?.trim() || !profile?.lastName?.trim();
}

export type MfaEnrollmentDecision = {
  required: boolean;
  reason:
    | 'test-account'
    | 'devo-sms-bypass'
    | 'already-enrolled'
    | 'oauth-provider'
    | 'password-setup-complete'
    | 'password-needs-sms';
};

/**
 * SMS MFA is required only for email/password accounts.
 * Google/OAuth sign-in and any already-enrolled Firebase MFA factor skip enrollment.
 */
export function decideMfaEnrollment(
  user: User,
  profile?: UserProfile | null,
): MfaEnrollmentDecision {
  if (profile?.isTestAccount) {
    return { required: false, reason: 'test-account' };
  }

  // Devo debug banner: skip enrollment redirects without Firebase SMS.
  if (isDevoSmsBypassEnabled()) {
    return { required: false, reason: 'devo-sms-bypass' };
  }

  if (isMfaEnrolled(user)) {
    return { required: false, reason: 'already-enrolled' };
  }

  // Google / other federated providers are treated as sufficiently verified —
  // do not force FirmShake SMS enrollment.
  if (!isPasswordAuthUser(user)) {
    return { required: false, reason: 'oauth-provider' };
  }

  // finalizePasswordAccountSetup runs only after successful MFA enroll for password users.
  if (profile?.accountSetupComplete) {
    return { required: false, reason: 'password-setup-complete' };
  }

  return { required: true, reason: 'password-needs-sms' };
}

export function needsMfaEnrollment(user: User, profile?: UserProfile | null): boolean {
  const decision = decideMfaEnrollment(user, profile);
  debugLog.info('mfa', 'needsMfaEnrollment.decision', {
    uid: user.uid,
    required: decision.required,
    reason: decision.reason,
    providers: authProviderIds(user),
    isPasswordUser: isPasswordAuthUser(user),
    mfaEnrolled: isMfaEnrolled(user),
    isTestAccount: profile?.isTestAccount ?? null,
    accountSetupComplete: profile?.accountSetupComplete ?? null,
  });
  return decision.required;
}

export function resolvePostAuthPath(
  user: User,
  profile: UserProfile | null,
): string {
  const needsProfile = needsProfileCompletion(profile, user);
  const mfaDecision = decideMfaEnrollment(user, profile);
  const needsMfa = mfaDecision.required;

  let destination: string;
  if (needsProfile) {
    destination = '/complete-profile';
  } else if (needsMfa) {
    destination = '/mfa-enroll';
  } else {
    destination = '/tabs/home';
  }

  debugLog.info('auth', 'resolvePostAuthPath', {
    uid: user.uid,
    destination,
    needsProfile,
    needsMfa,
    mfaReason: mfaDecision.reason,
    providers: authProviderIds(user),
    profileComplete: profile?.profileComplete ?? null,
    firstName: profile?.firstName ?? null,
    lastName: profile?.lastName ?? null,
    isExternalAuth: isExternalAuthUser(user),
    mfaEnrolled: isMfaEnrolled(user),
  });

  return destination;
}
