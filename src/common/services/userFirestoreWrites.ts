import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';

import { db } from '@/common/services/firebase';
import type { UserProfile } from '@/types';
import { formatDisplayName, parseDisplayName } from '@/utils/displayName';
import {
  canManageCommunityModerators,
  isSuperAdmin,
} from '@/utils/moderation';

import { mapProfile } from '@/common/services/userProfileMapper';

function assertDb() {
  if (!db) {
    throw new Error('Firestore is not configured');
  }
  return db;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const firestore = assertDb();
  const snapshot = await getDoc(doc(firestore, 'users', uid));
  if (!snapshot.exists()) return null;
  return mapProfile(uid, snapshot.data());
}

export async function findUserByEmail(email: string): Promise<UserProfile | null> {
  const firestore = assertDb();
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const matches = await getDocs(
    query(collection(firestore, 'users'), where('email', '==', normalized)),
  );

  if (matches.empty) {
    const legacyMatches = await getDocs(
      query(collection(firestore, 'users'), where('email', '==', email.trim())),
    );
    if (legacyMatches.empty) {
      return null;
    }
    const docSnap = legacyMatches.docs[0];
    return mapProfile(docSnap.id, docSnap.data());
  }

  const docSnap = matches.docs[0];
  return mapProfile(docSnap.id, docSnap.data());
}

export async function fetchCommunityModerators(communityId: string): Promise<UserProfile[]> {
  const firestore = assertDb();
  const snapshot = await getDocs(
    query(
      collection(firestore, 'users'),
      where('moderatorCommunityIds', 'array-contains', communityId),
    ),
  );

  return snapshot.docs.map((entry) => mapProfile(entry.id, entry.data()));
}

export async function grantCommunityModerator(
  actor: UserProfile,
  targetUid: string,
  communityId: string,
): Promise<void> {
  const firestore = assertDb();

  if (!canManageCommunityModerators(actor, communityId)) {
    throw new Error('You do not have permission to grant moderators for this community');
  }

  const target = await getUserProfile(targetUid);
  if (!target) {
    throw new Error('User not found');
  }

  if (isSuperAdmin(target)) {
    throw new Error('Super admin moderator access cannot be changed');
  }

  if (target.moderatorCommunityIds.includes(communityId)) {
    return;
  }

  if (!isSuperAdmin(actor) && !actor.moderatorCommunityIds.includes(communityId)) {
    throw new Error('You can only grant moderators for communities you moderate');
  }

  await updateDoc(doc(firestore, 'users', targetUid), {
    moderatorCommunityIds: arrayUnion(communityId),
  });
}

export async function revokeCommunityModerator(
  actor: UserProfile,
  targetUid: string,
  communityId: string,
): Promise<void> {
  const firestore = assertDb();

  if (!canManageCommunityModerators(actor, communityId)) {
    throw new Error('You do not have permission to revoke moderators for this community');
  }

  const target = await getUserProfile(targetUid);
  if (!target) {
    throw new Error('User not found');
  }

  if (isSuperAdmin(target)) {
    throw new Error('Super admin moderator access cannot be changed');
  }

  if (!isSuperAdmin(actor) && !actor.moderatorCommunityIds.includes(communityId)) {
    throw new Error('You can only revoke moderators for communities you moderate');
  }

  if (!target.moderatorCommunityIds.includes(communityId)) {
    return;
  }

  await updateDoc(doc(firestore, 'users', targetUid), {
    moderatorCommunityIds: arrayRemove(communityId),
  });
}

export async function joinCommunity(uid: string, communityId: string): Promise<void> {
  const firestore = assertDb();
  const profile = await getUserProfile(uid);
  if (!profile) return;

  if (profile.communityIds.includes(communityId)) return;

  await updateDoc(doc(firestore, 'users', uid), {
    communityIds: [...profile.communityIds, communityId],
  });
}

export async function leaveCommunity(uid: string, communityId: string): Promise<void> {
  if (communityId === 'all') return;

  const firestore = assertDb();
  const profile = await getUserProfile(uid);
  if (!profile) return;

  await updateDoc(doc(firestore, 'users', uid), {
    communityIds: profile.communityIds.filter((id) => id !== communityId),
  });
}

export async function updateUserPhotoUrl(uid: string, photoUrl: string): Promise<void> {
  const firestore = assertDb();
  await updateDoc(doc(firestore, 'users', uid), { photoUrl });
}

export async function finalizePasswordAccountSetup(uid: string): Promise<void> {
  const firestore = assertDb();
  await updateDoc(doc(firestore, 'users', uid), {
    accountSetupComplete: true,
    profileComplete: true,
  });
}

export async function completeUserProfileNames(
  uid: string,
  firstName: string,
  lastName: string,
): Promise<void> {
  const firestore = assertDb();
  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();
  if (!trimmedFirst || !trimmedLast) {
    throw new Error('First name and last name are required');
  }

  await updateDoc(doc(firestore, 'users', uid), {
    firstName: trimmedFirst,
    lastName: trimmedLast,
    displayName: formatDisplayName(trimmedFirst, trimmedLast),
    profileComplete: true,
  });
}
