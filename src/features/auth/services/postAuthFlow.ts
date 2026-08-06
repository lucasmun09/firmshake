import type { User } from 'firebase/auth';

import type { UserProfile } from '@/types';
import { debugLog } from '@/common/debug/debugLog';
import { isMfaEnrolled, isPasswordAuthUser } from '@/features/auth/services/mfa';

export function isExternalAuthUser(user: User): boolean {
  const providers = user.providerData.map((entry) => entry.providerId);
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

export function needsMfaEnrollment(user: User, profile?: UserProfile | null): boolean {
  if (profile?.isTestAccount) {
    return false;
  }

  if (isMfaEnrolled(user)) {
    return false;
  }

  // finalizePasswordAccountSetup runs only after successful MFA enroll for password users.
  if (isPasswordAuthUser(user) && profile?.accountSetupComplete) {
    return false;
  }

  return true;
}

export function resolvePostAuthPath(
  user: User,
  profile: UserProfile | null,
): string {
  const needsProfile = needsProfileCompletion(profile, user);
  const needsMfa = needsMfaEnrollment(user, profile);

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
    profileComplete: profile?.profileComplete ?? null,
    firstName: profile?.firstName ?? null,
    lastName: profile?.lastName ?? null,
    isExternalAuth: isExternalAuthUser(user),
    mfaEnrolled: isMfaEnrolled(user),
  });

  return destination;
}
