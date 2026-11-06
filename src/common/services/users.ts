import {
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import { debugLog, serializeError } from '@/common/debug/debugLog';
import {
  createFirestoreSnapshotErrorHandler,
  handleFirestorePermissionDenied,
  isSessionExpiredError,
} from '@/common/services/firestoreAuth';
import {
  routeCompleteUserProfileNames,
  routeFetchCommunityModerators,
  routeFindUserByEmail,
  routeFinalizePasswordAccountSetup,
  routeGrantCommunityModerator,
  routeJoinCommunity,
  routeLeaveCommunity,
  routeRevokeCommunityModerator,
  routeUpdateUserPhotoUrl,
} from '@/common/services/userServiceRouter';
import type { UserProfile } from '@/types';
import {
  buildUserCacheKey,
  getCached,
  getStaleCached,
} from '@/common/services/responseCache';
import { mapProfile, resolveAccountSetupComplete } from '@/common/services/userProfileMapper';
import { db } from '@/common/services/firebase';

function profileCacheKey(uid: string): string {
  return buildUserCacheKey(uid, 'profile', { tab: 'bootstrap' });
}

export { mapProfile, resolveAccountSetupComplete } from '@/common/services/userProfileMapper';

export function getCachedUserProfile(uid: string): UserProfile | null {
  return getStaleCached<UserProfile>(profileCacheKey(uid));
}

export function isIncompletePasswordRegistration(
  profile: UserProfile | null,
  options?: { authProvider?: UserProfile['authProvider'] },
): boolean {
  if (!profile) {
    return options?.authProvider === 'password';
  }

  if (profile.authProvider === 'google.com') {
    return false;
  }

  return !profile.accountSetupComplete;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db) return null;

  const cached = getCached<UserProfile>(profileCacheKey(uid));
  if (cached) {
    return cached;
  }

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

  return onSnapshot(
    doc(db, 'users', uid),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      onData(mapProfile(uid, snapshot.data()));
    },
    (error) => {
      if (isSessionExpiredError(error)) {
        return;
      }

      void handleFirestorePermissionDenied(error, 'subscribeUserProfile').then((handled) => {
        if (handled) {
          return;
        }

        debugLog.warn('auth', 'User profile subscription failed', {
          uid,
          error: serializeError(error),
        });
        onData(null);
      });
    },
  );
}

export async function findUserByEmail(email: string): Promise<UserProfile | null> {
  return routeFindUserByEmail(email);
}

export async function fetchCommunityModerators(communityId: string): Promise<UserProfile[]> {
  return routeFetchCommunityModerators(communityId);
}

export async function grantCommunityModerator(
  actor: UserProfile,
  targetUid: string,
  communityId: string,
): Promise<void> {
  return routeGrantCommunityModerator(actor, targetUid, communityId);
}

export async function revokeCommunityModerator(
  actor: UserProfile,
  targetUid: string,
  communityId: string,
): Promise<void> {
  return routeRevokeCommunityModerator(actor, targetUid, communityId);
}

export async function joinCommunity(uid: string, communityId: string): Promise<void> {
  return routeJoinCommunity(uid, communityId);
}

export async function leaveCommunity(uid: string, communityId: string): Promise<void> {
  return routeLeaveCommunity(uid, communityId);
}

export async function updateUserPhotoUrl(uid: string, photoUrl: string): Promise<void> {
  return routeUpdateUserPhotoUrl(uid, photoUrl);
}

export async function deleteUserProfile(uid: string): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  await deleteDoc(doc(db, 'users', uid));
}

export async function finalizePasswordAccountSetup(uid: string): Promise<void> {
  return routeFinalizePasswordAccountSetup(uid);
}

export async function completeUserProfileNames(
  uid: string,
  firstName: string,
  lastName: string,
): Promise<void> {
  return routeCompleteUserProfileNames(uid, firstName, lastName);
}
