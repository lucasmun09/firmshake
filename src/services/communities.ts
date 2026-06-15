import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { ALL_COMMUNITY_ID, SEED_COMMUNITIES } from '@/data/seedCommunities';
import type { Community } from '@/types';
import { db } from './firebase';
import { joinCommunity } from './users';

function mapCommunity(id: string, data: Record<string, unknown>): Community {
  return {
    id,
    name: String(data.name ?? ''),
    type: (data.type as Community['type']) ?? 'user',
    description: String(data.description ?? ''),
  };
}

export async function fetchCommunities(): Promise<Community[]> {
  if (!db) return [...SEED_COMMUNITIES];

  const snapshot = await getDocs(collection(db, 'communities'));
  if (snapshot.empty) return [];

  const communities = snapshot.docs.map((entry) =>
    mapCommunity(entry.id, entry.data()),
  );

  return communities.sort((a, b) => {
    if (a.id === ALL_COMMUNITY_ID) return -1;
    if (b.id === ALL_COMMUNITY_ID) return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function ensureCommunitiesSeeded(): Promise<void> {
  if (!db) return;
  const firestore = db;

  await Promise.all(
    SEED_COMMUNITIES.map(async (community) => {
      const communityRef = doc(firestore, 'communities', community.id);
      const existing = await getDoc(communityRef);
      if (existing.exists()) return;

      await setDoc(communityRef, {
        name: community.name,
        type: community.type,
        description: community.description,
        createdBy: 'system',
        memberCount: 0,
        createdAt: serverTimestamp(),
      });
    }),
  );
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
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  const docRef = await addDoc(collection(db, 'communities'), {
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
