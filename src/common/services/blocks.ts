import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/common/services/firebase';
import { ensureFirestoreAuth } from '@/common/services/firestoreAuth';
import {
  routeBlockUser,
  routeUnblockUser,
} from '@/common/services/blockServiceRouter';

export interface BlockedUserEntry {
  blockedUserId: string;
  blockedAt?: unknown;
}

export function subscribeBlockedUsers(
  blockerId: string,
  onData: (entries: BlockedUserEntry[]) => void,
): Unsubscribe {
  if (!db) {
    onData([]);
    return () => undefined;
  }

  return onSnapshot(
    collection(db, 'users', blockerId, 'blockedUsers'),
    (snapshot) => {
      onData(
        snapshot.docs.map((docSnap) => ({
          blockedUserId: docSnap.id,
          blockedAt: docSnap.data().blockedAt,
        })),
      );
    },
    () => onData([]),
  );
}

export async function blockUser(blockerId: string, blockedUserId: string): Promise<void> {
  if (!db || blockerId === blockedUserId) {
    return;
  }

  await ensureFirestoreAuth();
  await routeBlockUser(blockerId, blockedUserId);
}

export async function unblockUser(blockerId: string, blockedUserId: string): Promise<void> {
  if (!db || blockerId === blockedUserId) {
    return;
  }

  await ensureFirestoreAuth();
  await routeUnblockUser(blockerId, blockedUserId);
}

export async function isUserBlocked(
  blockerId: string,
  blockedUserId: string,
): Promise<boolean> {
  if (!db || blockerId === blockedUserId) {
    return false;
  }

  await ensureFirestoreAuth();

  const snapshot = await getDoc(
    doc(db, 'users', blockerId, 'blockedUsers', blockedUserId),
  );
  return snapshot.exists();
}

export function subscribeUserBlocked(
  blockerId: string,
  blockedUserId: string,
  onBlocked: (blocked: boolean) => void,
): Unsubscribe {
  if (!db) {
    onBlocked(false);
    return () => undefined;
  }

  return onSnapshot(
    doc(db, 'users', blockerId, 'blockedUsers', blockedUserId),
    (snapshot) => onBlocked(snapshot.exists()),
    () => onBlocked(false),
  );
}
