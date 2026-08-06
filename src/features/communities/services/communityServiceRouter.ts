/**
 * Routes community create mutations to Firestore or firmshake-api.
 */
import { useBffUsers } from '@/common/config/featureFlags';
import type { Community } from '@/types';

import { createUserCommunityViaBff } from './communityBff';
import * as communityFirestoreWrites from './communityFirestoreWrites';

export function shouldRouteCommunitiesViaBff(): boolean {
  return useBffUsers();
}

export async function routeCreateUserCommunity(
  uid: string,
  name: string,
  description: string,
): Promise<Community> {
  if (useBffUsers()) {
    return createUserCommunityViaBff(uid, name, description);
  }
  return communityFirestoreWrites.createUserCommunity(uid, name, description);
}
