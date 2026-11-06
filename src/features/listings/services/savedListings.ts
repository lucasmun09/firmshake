import type { Listing, ListingSummary } from '@/types';
import { toListingSummary } from '@/features/listings/utils/listingSummary';

import {
  getListingPrefsOwnerUid,
  isListingPrefsStorageAvailable,
  listingPrefsStorageKey,
  setListingPrefsOwnerUid,
} from '@/features/listings/services/listingPrefsStorage';

const SAVED_NAMESPACE = 'saved-listings';
export const SAVED_LISTINGS_MAX = 50;
/** Soft cap so unsync'd deletes cannot grow localStorage without bound. */
export const SAVED_LISTINGS_TOMBSTONE_MAX = 100;

export interface SavedListingEntry {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
  savedAt: number;
}

export interface SavedListingTombstone {
  id: string;
  deletedAt: number;
}

interface StoredSavedListingsPayload {
  version: 1 | 2;
  orderedIds: string[];
  entriesById: Record<string, SavedListingEntry>;
  tombstonesById?: Record<string, SavedListingTombstone>;
}

function emptyPayload(): StoredSavedListingsPayload {
  return { version: 2, orderedIds: [], entriesById: {}, tombstonesById: {} };
}

function savedStorageKey(uid: string): string {
  return listingPrefsStorageKey(uid, SAVED_NAMESPACE);
}

function normalizeTombstones(
  raw: Record<string, SavedListingTombstone> | undefined,
): Record<string, SavedListingTombstone> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const next: Record<string, SavedListingTombstone> = {};
  for (const [id, tombstone] of Object.entries(raw)) {
    const resolvedId = String(tombstone?.id ?? id ?? '').trim();
    const deletedAt = Number(tombstone?.deletedAt);
    if (!resolvedId || !Number.isFinite(deletedAt) || deletedAt <= 0) {
      continue;
    }
    next[resolvedId] = { id: resolvedId, deletedAt };
  }
  return next;
}

function readPayload(uid: string): StoredSavedListingsPayload {
  if (!isListingPrefsStorageAvailable()) {
    return emptyPayload();
  }

  try {
    const raw = localStorage.getItem(savedStorageKey(uid));
    if (!raw) {
      return emptyPayload();
    }

    const parsed = JSON.parse(raw) as StoredSavedListingsPayload;
    if (
      (parsed.version !== 1 && parsed.version !== 2) ||
      !Array.isArray(parsed.orderedIds) ||
      !parsed.entriesById
    ) {
      return emptyPayload();
    }

    return {
      version: 2,
      orderedIds: parsed.orderedIds,
      entriesById: parsed.entriesById,
      tombstonesById: normalizeTombstones(parsed.tombstonesById),
    };
  } catch {
    return emptyPayload();
  }
}

function writePayload(uid: string, payload: StoredSavedListingsPayload): void {
  if (!isListingPrefsStorageAvailable()) {
    return;
  }

  try {
    localStorage.setItem(
      savedStorageKey(uid),
      JSON.stringify({
        version: 2,
        orderedIds: payload.orderedIds,
        entriesById: payload.entriesById,
        tombstonesById: payload.tombstonesById ?? {},
      }),
    );
  } catch {
    // Ignore quota errors.
  }
}

function trimTombstones(
  tombstonesById: Record<string, SavedListingTombstone>,
  max = SAVED_LISTINGS_TOMBSTONE_MAX,
): Record<string, SavedListingTombstone> {
  const ordered = Object.values(tombstonesById).sort(
    (a, b) => b.deletedAt - a.deletedAt || a.id.localeCompare(b.id),
  );
  const kept = ordered.slice(0, Math.max(0, max));
  const next: Record<string, SavedListingTombstone> = {};
  for (const tombstone of kept) {
    next[tombstone.id] = tombstone;
  }
  return next;
}

function toSavedEntry(source: Listing | ListingSummary, savedAt: number): SavedListingEntry {
  const summary = 'imageUrls' in source ? toListingSummary(source) : source;
  return {
    id: summary.id,
    title: summary.title,
    price: summary.price,
    imageUrl: summary.imageUrl,
    savedAt,
  };
}

export function getSavedListings(uid: string): SavedListingEntry[] {
  const payload = readPayload(uid);
  return payload.orderedIds
    .map((id) => payload.entriesById[id])
    .filter((entry): entry is SavedListingEntry => Boolean(entry));
}

export function getSavedListingTombstones(uid: string): SavedListingTombstone[] {
  const payload = readPayload(uid);
  return Object.values(payload.tombstonesById ?? {}).sort(
    (a, b) => b.deletedAt - a.deletedAt || a.id.localeCompare(b.id),
  );
}

/** Replace the full local saved list (used after remote hydrate/merge). Preserves tombstones. */
export function setSavedListings(uid: string, entries: SavedListingEntry[]): void {
  const payload = readPayload(uid);
  writeSavedState(uid, entries, Object.values(payload.tombstonesById ?? {}));
}

/** Replace local entries + tombstones together (hydrate path). */
export function setSavedListingsState(
  uid: string,
  entries: SavedListingEntry[],
  tombstones: SavedListingTombstone[],
): void {
  writeSavedState(uid, entries, tombstones);
}

function writeSavedState(
  uid: string,
  entries: SavedListingEntry[],
  tombstones: SavedListingTombstone[],
): void {
  const ordered = entries.slice(0, SAVED_LISTINGS_MAX);
  const entriesById: Record<string, SavedListingEntry> = {};
  const orderedIds: string[] = [];

  for (const entry of ordered) {
    if (!entry?.id || entriesById[entry.id]) {
      continue;
    }
    orderedIds.push(entry.id);
    entriesById[entry.id] = {
      id: entry.id,
      title: String(entry.title ?? ''),
      price: Number(entry.price) || 0,
      imageUrl: String(entry.imageUrl ?? ''),
      savedAt: Number(entry.savedAt) || 0,
    };
  }

  // Tombstones for ids that are saved again must not linger.
  const tombstonesById: Record<string, SavedListingTombstone> = {};
  for (const tombstone of tombstones) {
    const id = String(tombstone?.id ?? '').trim();
    const deletedAt = Number(tombstone?.deletedAt);
    if (!id || entriesById[id] || !Number.isFinite(deletedAt) || deletedAt <= 0) {
      continue;
    }
    const existing = tombstonesById[id];
    if (!existing || deletedAt > existing.deletedAt) {
      tombstonesById[id] = { id, deletedAt };
    }
  }

  writePayload(uid, {
    version: 2,
    orderedIds,
    entriesById,
    tombstonesById: trimTombstones(tombstonesById),
  });
}

export function isListingSaved(uid: string, listingId: string): boolean {
  const payload = readPayload(uid);
  return payload.orderedIds.includes(listingId);
}

export function saveListing(
  uid: string,
  listing: Listing | ListingSummary,
  savedAt = Date.now(),
): { saved: boolean; entries: SavedListingEntry[] } {
  const payload = readPayload(uid);
  if (payload.orderedIds.includes(listing.id)) {
    return { saved: true, entries: getSavedListings(uid) };
  }

  if (payload.orderedIds.length >= SAVED_LISTINGS_MAX) {
    return { saved: false, entries: getSavedListings(uid) };
  }

  const entry = toSavedEntry(listing, savedAt);
  const nextIds = [entry.id, ...payload.orderedIds];
  const nextEntries = { ...payload.entriesById, [entry.id]: entry };
  const nextTombstones = { ...(payload.tombstonesById ?? {}) };
  delete nextTombstones[entry.id];

  writePayload(uid, {
    version: 2,
    orderedIds: nextIds,
    entriesById: nextEntries,
    tombstonesById: nextTombstones,
  });
  return { saved: true, entries: getSavedListings(uid) };
}

export function unsaveListing(
  uid: string,
  listingId: string,
  deletedAt = Date.now(),
): SavedListingEntry[] {
  const payload = readPayload(uid);
  const wasSaved = payload.orderedIds.includes(listingId);
  const existingTombstone = payload.tombstonesById?.[listingId];

  if (!wasSaved && existingTombstone && existingTombstone.deletedAt >= deletedAt) {
    return getSavedListings(uid);
  }

  const nextIds = payload.orderedIds.filter((id) => id !== listingId);
  const nextEntries = { ...payload.entriesById };
  delete nextEntries[listingId];

  const nextTombstones = { ...(payload.tombstonesById ?? {}) };
  if (listingId) {
    const prior = nextTombstones[listingId]?.deletedAt ?? 0;
    nextTombstones[listingId] = {
      id: listingId,
      deletedAt: Math.max(prior, deletedAt),
    };
  }

  writePayload(uid, {
    version: 2,
    orderedIds: nextIds,
    entriesById: nextEntries,
    tombstonesById: trimTombstones(nextTombstones),
  });
  return getSavedListings(uid);
}

export function toggleSavedListing(
  uid: string,
  listing: Listing | ListingSummary,
): { saved: boolean; entries: SavedListingEntry[] } {
  if (isListingSaved(uid, listing.id)) {
    return { saved: false, entries: unsaveListing(uid, listing.id) };
  }

  return saveListing(uid, listing);
}

export function clearSavedListings(uid: string): void {
  if (!isListingPrefsStorageAvailable()) {
    return;
  }

  try {
    localStorage.removeItem(savedStorageKey(uid));
  } catch {
    // Ignore storage errors.
  }
}

export function clearListingPrefsIfUserChanged(uid: string): void {
  const owner = getListingPrefsOwnerUid();
  if (owner && owner !== uid) {
    clearRecentListingsForOwner(owner);
    clearSavedListings(owner);
  }

  setListingPrefsOwnerUid(uid);
}

function clearRecentListingsForOwner(uid: string): void {
  if (!isListingPrefsStorageAvailable()) {
    return;
  }

  try {
    localStorage.removeItem(listingPrefsStorageKey(uid, 'recent-listings'));
  } catch {
    // Ignore storage errors.
  }
}
