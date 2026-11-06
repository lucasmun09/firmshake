import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';

import { db } from '@/common/services/firebase';
import { ensureFirestoreAuth } from '@/common/services/firestoreAuth';
import type { SavedListingEntry } from '@/features/listings/services/savedListings';

export const SAVED_LISTINGS_COLLECTION = 'savedListings';

function assertDb() {
  if (!db) {
    throw new Error('Firestore is not configured');
  }
  return db;
}

export function canSyncSavedListingsRemote(uid: string): boolean {
  return Boolean(uid) && uid !== 'anonymous' && Boolean(db);
}

export function mapSavedListingRemoteDoc(
  listingId: string,
  data: Record<string, unknown>,
): SavedListingEntry | null {
  const id = String(data.listingId ?? listingId ?? '').trim();
  if (!id) {
    return null;
  }

  const savedAtRaw = data.savedAt;
  const savedAt =
    typeof savedAtRaw === 'number'
      ? savedAtRaw
      : typeof savedAtRaw === 'string'
        ? Number(savedAtRaw)
        : 0;

  return {
    id,
    title: String(data.title ?? ''),
    price: Number(data.price) || 0,
    imageUrl: String(data.imageUrl ?? ''),
    savedAt: Number.isFinite(savedAt) ? savedAt : 0,
  };
}

export async function fetchSavedListingsRemote(uid: string): Promise<SavedListingEntry[]> {
  if (!canSyncSavedListingsRemote(uid)) {
    return [];
  }

  const firestore = assertDb();
  await ensureFirestoreAuth();

  const snapshot = await getDocs(collection(firestore, 'users', uid, SAVED_LISTINGS_COLLECTION));
  const entries: SavedListingEntry[] = [];

  for (const docSnap of snapshot.docs) {
    const mapped = mapSavedListingRemoteDoc(docSnap.id, docSnap.data() as Record<string, unknown>);
    if (mapped) {
      entries.push(mapped);
    }
  }

  return entries.sort((a, b) => b.savedAt - a.savedAt || a.id.localeCompare(b.id));
}

export async function upsertSavedListingRemote(
  uid: string,
  entry: SavedListingEntry,
): Promise<void> {
  if (!canSyncSavedListingsRemote(uid) || !entry.id) {
    return;
  }

  const firestore = assertDb();
  await ensureFirestoreAuth();

  await setDoc(doc(firestore, 'users', uid, SAVED_LISTINGS_COLLECTION, entry.id), {
    listingId: entry.id,
    title: entry.title,
    price: entry.price,
    imageUrl: entry.imageUrl,
    savedAt: entry.savedAt,
  });
}

export async function deleteSavedListingRemote(uid: string, listingId: string): Promise<void> {
  if (!canSyncSavedListingsRemote(uid) || !listingId) {
    return;
  }

  const firestore = assertDb();
  await ensureFirestoreAuth();

  await deleteDoc(doc(firestore, 'users', uid, SAVED_LISTINGS_COLLECTION, listingId));
}
