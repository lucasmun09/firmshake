/**
 * Routes user profile, block, and moderation mutations to Firestore or firmshake-api.
 */
import { useBffUsers } from '@/common/config/featureFlags';
import type { UserProfile } from '@/types';

import * as userBff from './userBff';
import * as userFirestoreWrites from './userFirestoreWrites';

export function shouldRouteUsersViaBff(): boolean {
  return useBffUsers();
}

export async function routeCompleteUserProfileNames(
  uid: string,
  firstName: string,
  lastName: string,
): Promise<void> {
  if (useBffUsers()) {
    await userBff.completeUserProfileNamesViaBff(firstName, lastName);
    return;
  }
  await userFirestoreWrites.completeUserProfileNames(uid, firstName, lastName);
}

export async function routeUpdateUserPhotoUrl(uid: string, photoUrl: string): Promise<void> {
  if (useBffUsers()) {
    await userBff.updateUserPhotoUrlViaBff(photoUrl);
    return;
  }
  await userFirestoreWrites.updateUserPhotoUrl(uid, photoUrl);
}

export async function routeFinalizePasswordAccountSetup(uid: string): Promise<void> {
  if (useBffUsers()) {
    await userBff.finalizePasswordAccountSetupViaBff();
    return;
  }
  await userFirestoreWrites.finalizePasswordAccountSetup(uid);
}

export async function routeJoinCommunity(uid: string, communityId: string): Promise<void> {
  if (useBffUsers()) {
    await userBff.joinCommunityViaBffApi(uid, communityId);
    return;
  }
  await userFirestoreWrites.joinCommunity(uid, communityId);
}

export async function routeLeaveCommunity(uid: string, communityId: string): Promise<void> {
  if (useBffUsers()) {
    await userBff.leaveCommunityViaBffApi(uid, communityId);
    return;
  }
  await userFirestoreWrites.leaveCommunity(uid, communityId);
}

export async function routeFindUserByEmail(email: string): Promise<UserProfile | null> {
  if (useBffUsers()) {
    return userBff.findUserByEmailViaBffApi(email);
  }
  return userFirestoreWrites.findUserByEmail(email);
}

export async function routeGrantCommunityModerator(
  actor: UserProfile,
  targetUid: string,
  communityId: string,
): Promise<void> {
  if (useBffUsers()) {
    await userBff.grantCommunityModeratorViaBffApi(actor, targetUid, communityId);
    return;
  }
  await userFirestoreWrites.grantCommunityModerator(actor, targetUid, communityId);
}

export async function routeRevokeCommunityModerator(
  actor: UserProfile,
  targetUid: string,
  communityId: string,
): Promise<void> {
  if (useBffUsers()) {
    await userBff.revokeCommunityModeratorViaBffApi(actor, targetUid, communityId);
    return;
  }
  await userFirestoreWrites.revokeCommunityModerator(actor, targetUid, communityId);
}

export async function routeFetchCommunityModerators(communityId: string): Promise<UserProfile[]> {
  if (useBffUsers()) {
    const { fetchCommunityModeratorsViaBffApi } = await import(
      '@/features/communities/services/communityBff'
    );
    return fetchCommunityModeratorsViaBffApi(communityId);
  }
  return userFirestoreWrites.fetchCommunityModerators(communityId);
}
