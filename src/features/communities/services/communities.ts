import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromCache,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { ALL_COMMUNITY_ID, SEED_COMMUNITIES } from '@/features/communities/data/seedCommunities';
import { routeCreateUserCommunity } from '@/features/communities/services/communityServiceRouter';
import type { Community } from '@/types';
import { debugLog, serializeError } from '@/common/debug/debugLog';
import { auth, db } from '@/common/services/firebase';
import {
  handleFirestorePermissionDenied,
  isSessionExpiredError,
} from '@/common/services/firestoreAuth';
import {
  buildCacheKey,
  getCached,
  invalidateCached,
  setCached,
} from '@/common/services/responseCache';

const COMMUNITIES_CACHE_KEY = buildCacheKey('communities', { tab: 'all' });

function mapCommunity(id: string, data: Record<string, unknown>): Community {
  return {
    id,
    name: String(data.name ?? ''),
    type: (data.type as Community['type']) ?? 'user',
    description: String(data.description ?? ''),
  };
}

export async function fetchCommunities(options?: {
  preferCache?: boolean;
  forceRefresh?: boolean;
}): Promise<Community[]> {
  if (!db) return [...SEED_COMMUNITIES];

  if (!options?.forceRefresh) {
    const cached = getCached<Community[]>(COMMUNITIES_CACHE_KEY);
    if (cached) {
      return cached;
    }
  }

  const communitiesRef = collection(db, 'communities');

  if (options?.preferCache) {
    try {
      const cached = await getDocsFromCache(communitiesRef);
      if (!cached.empty) {
        const communities = sortCommunities(
          cached.docs.map((entry) => mapCommunity(entry.id, entry.data())),
        );
        setCached(COMMUNITIES_CACHE_KEY, communities);
        return communities;
      }
    } catch {
      // Fall through to network read.
    }
  }

  try {
    const snapshot = await getDocs(communitiesRef);
    if (snapshot.empty) {
      debugLog.warn('communities', 'fetchCommunities: Firestore returned no communities');
      return [];
    }

    const communities = sortCommunities(
      snapshot.docs.map((entry) => mapCommunity(entry.id, entry.data())),
    );
    setCached(COMMUNITIES_CACHE_KEY, communities);
    return communities;
  } catch (error) {
    debugLog.warn('communities', 'fetchCommunities failed', {
      error: serializeError(error),
    });
    throw error;
  }
}

export function invalidateCommunitiesCache(): void {
  invalidateCached(COMMUNITIES_CACHE_KEY);
}

function sortCommunities(communities: Community[]): Community[] {
  return communities.sort((a, b) => {
    if (a.id === ALL_COMMUNITY_ID) return -1;
    if (b.id === ALL_COMMUNITY_ID) return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function ensureCommunitiesSeeded(): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const firestore = db;

  for (const community of SEED_COMMUNITIES) {
    const communityRef = doc(firestore, 'communities', community.id);
    const existing = await getDoc(communityRef);
    if (existing.exists()) {
      continue;
    }

    try {
      await setDoc(communityRef, {
        name: community.name,
        type: community.type,
        description: community.description,
        createdBy: 'system',
        memberCount: 0,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code: unknown }).code)
          : '';
      if (code === 'permission-denied') {
        try {
          const retry = await getDoc(communityRef);
          if (retry.exists()) {
            continue;
          }
        } catch (readError) {
          if (isSessionExpiredError(readError)) {
            return;
          }
          debugLog.warn('communities', 'ensureCommunitiesSeeded: could not verify community after seed denied', {
            communityId: community.id,
            error: serializeError(readError),
          });
        }

        const handled = await handleFirestorePermissionDenied(error, 'ensureCommunitiesSeeded');
        if (handled) {
          return;
        }

        debugLog.warn('communities', 'ensureCommunitiesSeeded: permission-denied and community missing', {
          communityId: community.id,
          error: serializeError(error),
        });
      }
      throw error;
    }
  }
}

export function getCommunityName(
  communities: Community[],
  communityId: string,
): string | undefined {
  return communities.find((c) => c.id === communityId)?.name;
}

export async function findCommunityByName(name: string): Promise<Community | null> {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;

  const communities = await fetchCommunities();
  return (
    communities.find(
      (community) =>
        community.id !== ALL_COMMUNITY_ID &&
        community.name.trim().toLowerCase() === normalized,
    ) ?? null
  );
}

export async function createUserCommunity(
  uid: string,
  name: string,
  description: string,
): Promise<Community> {
  const community = await routeCreateUserCommunity(uid, name, description);
  invalidateCommunitiesCache();
  return community;
}
