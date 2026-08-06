/**
 * Routes block/unblock mutations to Firestore or firmshake-api.
 */
import { useBffUsers } from '@/common/config/featureFlags';

import { blockUserViaBff, unblockUserViaBff } from './userBff';
import * as blockFirestoreWrites from './blockFirestoreWrites';

export function shouldRouteBlocksViaBff(): boolean {
  return useBffUsers();
}

export async function routeBlockUser(blockerId: string, blockedUserId: string): Promise<void> {
  if (useBffUsers()) {
    await blockUserViaBff(blockedUserId);
    return;
  }
  await blockFirestoreWrites.blockUser(blockerId, blockedUserId);
}

export async function routeUnblockUser(blockerId: string, blockedUserId: string): Promise<void> {
  if (useBffUsers()) {
    await unblockUserViaBff(blockedUserId);
    return;
  }
  await blockFirestoreWrites.unblockUser(blockerId, blockedUserId);
}
