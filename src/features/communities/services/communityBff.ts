import { createCommunityViaBff, fetchCommunityModeratorsViaBff } from '@/common/services/api';
import type { Community, UserProfile } from '@/types';

export async function createUserCommunityViaBff(
  uid: string,
  name: string,
  description: string,
): Promise<Community> {
  void uid;
  const community = await createCommunityViaBff(name, description);
  return {
    id: community.id,
    name: community.name,
    type: community.type,
    description: community.description,
  };
}

export async function fetchCommunityModeratorsViaBffApi(
  communityId: string,
): Promise<UserProfile[]> {
  const moderators = await fetchCommunityModeratorsViaBff(communityId);
  return moderators.map((moderator) => ({
    uid: moderator.uid,
    email: moderator.email,
    firstName: moderator.firstName,
    lastName: moderator.lastName,
    displayName: moderator.displayName,
    photoUrl: moderator.photoUrl,
    communityIds: moderator.communityIds,
    isAdmin: moderator.isAdmin,
    isSuperAdmin: moderator.isSuperAdmin,
    moderatorCommunityIds: moderator.moderatorCommunityIds,
    profileComplete: moderator.profileComplete,
    accountSetupComplete: moderator.accountSetupComplete,
    authProvider: moderator.authProvider,
  }));
}
