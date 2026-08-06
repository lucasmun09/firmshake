import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { db } from '@/common/services/firebase';
import { ensureFirestoreAuth } from '@/common/services/firestoreAuth';

function assertDb() {
  if (!db) {
    throw new Error('Firestore is not configured');
  }
  return db;
}

export async function blockUser(blockerId: string, blockedUserId: string): Promise<void> {
  if (blockerId === blockedUserId) {
    return;
  }

  const firestore = assertDb();
  await ensureFirestoreAuth();

  await setDoc(doc(firestore, 'users', blockerId, 'blockedUsers', blockedUserId), {
    blockedUserId,
    blockedAt: serverTimestamp(),
  });
}

export async function unblockUser(blockerId: string, blockedUserId: string): Promise<void> {
  if (blockerId === blockedUserId) {
    return;
  }

  const firestore = assertDb();
  await ensureFirestoreAuth();

  await deleteDoc(doc(firestore, 'users', blockerId, 'blockedUsers', blockedUserId));
}
