import type { UserProfile } from '@/types';
import { formatDisplayName, parseDisplayName } from '@/utils/displayName';

function resolveAuthProvider(
  data: Record<string, unknown>,
): UserProfile['authProvider'] {
  return data.authProvider === 'google.com' || data.authProvider === 'password'
    ? data.authProvider
    : undefined;
}

/** Infer setup completion when legacy docs omit accountSetupComplete. */
export function resolveAccountSetupComplete(data: Record<string, unknown>): boolean {
  if (data.accountSetupComplete !== undefined) {
    return Boolean(data.accountSetupComplete);
  }

  const authProvider = resolveAuthProvider(data);
  if (authProvider === 'password') {
    return false;
  }

  return authProvider === 'google.com';
}

export function mapProfile(uid: string, data: Record<string, unknown>): UserProfile {
  const isSuperAdminValue = Boolean(data.isSuperAdmin) || Boolean(data.isAdmin);
  const storedFirstName = data.firstName ? String(data.firstName) : '';
  const storedLastName = data.lastName ? String(data.lastName) : '';
  const legacyDisplayName = String(data.displayName ?? '');
  const parsedLegacy = parseDisplayName(legacyDisplayName);
  const firstName = storedFirstName || parsedLegacy.firstName;
  const lastName = storedLastName || parsedLegacy.lastName;
  const displayName =
    legacyDisplayName.trim() || formatDisplayName(firstName, lastName) || 'FirmShake User';

  return {
    uid,
    email: String(data.email ?? ''),
    firstName,
    lastName,
    displayName,
    photoUrl: data.photoUrl ? String(data.photoUrl) : undefined,
    communityIds: Array.isArray(data.communityIds)
      ? data.communityIds.map(String)
      : ['all'],
    isAdmin: isSuperAdminValue,
    isSuperAdmin: isSuperAdminValue,
    moderatorCommunityIds: Array.isArray(data.moderatorCommunityIds)
      ? data.moderatorCommunityIds.map(String)
      : [],
    profileComplete: data.profileComplete !== undefined
      ? Boolean(data.profileComplete)
      : Boolean(firstName.trim() && lastName.trim()),
    accountSetupComplete: resolveAccountSetupComplete(data),
    authProvider: resolveAuthProvider(data),
  };
}
