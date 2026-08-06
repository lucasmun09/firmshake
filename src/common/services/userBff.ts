import {
  blockUserViaBff,
  findUserByEmailViaBff,
  grantCommunityModeratorViaBff,
  joinCommunityViaBff,
  leaveCommunityViaBff,
  patchUserViaBff,
  revokeCommunityModeratorViaBff,
  unblockUserViaBff,
  type BffUserProfileResponse,
} from '@/common/services/api';
import type { UserProfile } from '@/types';

function mapBffToUserProfile(data: BffUserProfileResponse): UserProfile {
  return {
    uid: data.uid,
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    displayName: data.displayName,
    photoUrl: data.photoUrl,
    communityIds: data.communityIds,
    isAdmin: data.isAdmin,
    isSuperAdmin: data.isSuperAdmin,
    moderatorCommunityIds: data.moderatorCommunityIds,
    profileComplete: data.profileComplete,
    accountSetupComplete: data.accountSetupComplete,
    authProvider: data.authProvider,
  };
}

export async function completeUserProfileNamesViaBff(
  firstName: string,
  lastName: string,
): Promise<void> {
  await patchUserViaBff({ firstName, lastName, profileComplete: true });
}

export async function updateUserPhotoUrlViaBff(photoUrl: string): Promise<void> {
  await patchUserViaBff({ photoUrl });
}

export async function finalizePasswordAccountSetupViaBff(): Promise<void> {
  await patchUserViaBff({ accountSetupComplete: true, profileComplete: true });
}

export async function joinCommunityViaBffApi(uid: string, communityId: string): Promise<void> {
  void uid;
  await joinCommunityViaBff(communityId);
}

export async function leaveCommunityViaBffApi(uid: string, communityId: string): Promise<void> {
  void uid;
  await leaveCommunityViaBff(communityId);
}

export async function findUserByEmailViaBffApi(email: string): Promise<UserProfile | null> {
  try {
    const profile = await findUserByEmailViaBff(email);
    return mapBffToUserProfile(profile);
  } catch (error) {
    if (error instanceof Error && error.message.includes('No user found')) {
      return null;
    }
    throw error;
  }
}

export async function grantCommunityModeratorViaBffApi(
  actor: UserProfile,
  targetUid: string,
  communityId: string,
): Promise<void> {
  void actor;
  await grantCommunityModeratorViaBff(communityId, targetUid);
}

export async function revokeCommunityModeratorViaBffApi(
  actor: UserProfile,
  targetUid: string,
  communityId: string,
): Promise<void> {
  void actor;
  await revokeCommunityModeratorViaBff(communityId, targetUid);
}

export { blockUserViaBff, unblockUserViaBff };
