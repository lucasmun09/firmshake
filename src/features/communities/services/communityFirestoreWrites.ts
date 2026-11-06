import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { db } from '@/common/services/firebase';
import { joinCommunity } from '@/common/services/userFirestoreWrites';
import type { Community } from '@/types';

function assertDb() {
  if (!db) {
    throw new Error('Firestore is not configured');
  }
  return db;
}

export async function createUserCommunity(
  uid: string,
  name: string,
  description: string,
): Promise<Community> {
  const firestore = assertDb();

  const docRef = await addDoc(collection(firestore, 'communities'), {
    name: name.trim(),
    type: 'user',
    description: description.trim(),
    createdBy: uid,
    memberCount: 1,
    createdAt: serverTimestamp(),
  });

  await joinCommunity(uid, docRef.id);

  return {
    id: docRef.id,
    name: name.trim(),
    type: 'user',
    description: description.trim(),
  };
}
