import {
  collection,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';

import { db } from '@/common/services/firebase';
import { ensureFirestoreAuth } from '@/common/services/firestoreAuth';
import type {
  SavedListingEntry,
  SavedListingTombstone,
} from '@/features/listings/services/savedListings';

export const SAVED_LISTINGS_COLLECTION = 'savedListings';

export interface SavedListingsRemoteState {
  entries: SavedListingEntry[];
  tombstones: SavedListingTombstone[];
}

function assertDb() {
  if (!db) {
    throw new Error('Firestore is not configured');
  }
  return db;
}

export function canSyncSavedListingsRemote(uid: string): boolean {
  return Boolean(uid) && uid !== 'anonymous' && Boolean(db);
}

function parseEpoch(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : 0;
  }
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Active bookmark doc → entry; `deleted: true` docs → null (use tombstone mapper). */
export function mapSavedListingRemoteDoc(
  listingId: string,
  data: Record<string, unknown>,
): SavedListingEntry | null {
  if (data.deleted === true) {
    return null;
  }

  const id = String(data.listingId ?? listingId ?? '').trim();
  if (!id) {
    return null;
  }

  return {
    id,
    title: String(data.title ?? ''),
    price: Number(data.price) || 0,
    imageUrl: String(data.imageUrl ?? ''),
    savedAt: parseEpoch(data.savedAt),
  };
}

export function mapSavedListingRemoteTombstone(
  listingId: string,
  data: Record<string, unknown>,
): SavedListingTombstone | null {
  if (data.deleted !== true) {
    return null;
  }

  const id = String(data.listingId ?? listingId ?? '').trim();
  if (!id) {
    return null;
  }

  const deletedAt = parseEpoch(data.deletedAt);
  if (deletedAt <= 0) {
    return null;
  }

  return { id, deletedAt };
}

export async function fetchSavedListingsRemoteState(
  uid: string,
): Promise<SavedListingsRemoteState> {
  if (!canSyncSavedListingsRemote(uid)) {
    return { entries: [], tombstones: [] };
  }

  const firestore = assertDb();
  await ensureFirestoreAuth();

  const snapshot = await getDocs(collection(firestore, 'users', uid, SAVED_LISTINGS_COLLECTION));
  const entries: SavedListingEntry[] = [];
  const tombstones: SavedListingTombstone[] = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() as Record<string, unknown>;
    const tombstone = mapSavedListingRemoteTombstone(docSnap.id, data);
    if (tombstone) {
      tombstones.push(tombstone);
      continue;
    }

    const mapped = mapSavedListingRemoteDoc(docSnap.id, data);
    if (mapped) {
      entries.push(mapped);
    }
  }

  entries.sort((a, b) => b.savedAt - a.savedAt || a.id.localeCompare(b.id));
  tombstones.sort((a, b) => b.deletedAt - a.deletedAt || a.id.localeCompare(b.id));
  return { entries, tombstones };
}

/** Active bookmarks only (legacy helper). */
export async function fetchSavedListingsRemote(uid: string): Promise<SavedListingEntry[]> {
  const state = await fetchSavedListingsRemoteState(uid);
  return state.entries;
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
    deleted: false,
    deletedAt: null,
  });
}

/** Soft-delete so other devices can LWW-merge instead of resurrecting from stale local saves. */
export async function tombstoneSavedListingRemote(
  uid: string,
  listingId: string,
  deletedAt = Date.now(),
): Promise<void> {
  if (!canSyncSavedListingsRemote(uid) || !listingId) {
    return;
  }

  const firestore = assertDb();
  await ensureFirestoreAuth();

  await setDoc(doc(firestore, 'users', uid, SAVED_LISTINGS_COLLECTION, listingId), {
    listingId,
    deleted: true,
    deletedAt,
    title: '',
    price: 0,
    imageUrl: '',
    savedAt: 0,
  });
}

/** @deprecated Prefer tombstoneSavedListingRemote — kept as alias for call-site clarity. */
export async function deleteSavedListingRemote(uid: string, listingId: string): Promise<void> {
  await tombstoneSavedListingRemote(uid, listingId);
}
