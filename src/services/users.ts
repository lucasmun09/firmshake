import { doc, getDoc, onSnapshot, updateDoc, type Unsubscribe } from 'firebase/firestore';

import type { UserProfile } from '@/types';
import { db } from './firebase';

function mapProfile(uid: string, data: Record<string, unknown>): UserProfile {
  return {
    uid,
    email: String(data.email ?? ''),
    displayName: String(data.displayName ?? 'FirmShake User'),
    communityIds: Array.isArray(data.communityIds)
      ? data.communityIds.map(String)
      : ['all'],
    isAdmin: Boolean(data.isAdmin),
  };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db) return null;

  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) return null;

  return mapProfile(uid, snapshot.data());
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
): Unsubscribe {
  if (!db) {
    onData(null);
    return () => undefined;
  }

  return onSnapshot(doc(db, 'users', uid), (snapshot) => {
    if (!snapshot.exists()) {
      onData(null);
      return;
    }
    onData(mapProfile(uid, snapshot.data()));
  });
}

export async function joinCommunity(uid: string, communityId: string): Promise<void> {
  if (!db) return;

  const profile = await getUserProfile(uid);
  if (!profile) return;

  if (profile.communityIds.includes(communityId)) return;

  await updateDoc(doc(db, 'users', uid), {
    communityIds: [...profile.communityIds, communityId],
  });
}

export async function leaveCommunity(uid: string, communityId: string): Promise<void> {
  if (!db || communityId === 'all') return;

  const profile = await getUserProfile(uid);
  if (!profile) return;

  await updateDoc(doc(db, 'users', uid), {
    communityIds: profile.communityIds.filter((id) => id !== communityId),
  });
}
