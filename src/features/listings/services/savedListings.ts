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

export interface SavedListingEntry {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
  savedAt: number;
}

interface StoredSavedListingsPayload {
  version: 1;
  orderedIds: string[];
  entriesById: Record<string, SavedListingEntry>;
}

function emptyPayload(): StoredSavedListingsPayload {
  return { version: 1, orderedIds: [], entriesById: {} };
}

function savedStorageKey(uid: string): string {
  return listingPrefsStorageKey(uid, SAVED_NAMESPACE);
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
    if (parsed.version !== 1 || !Array.isArray(parsed.orderedIds) || !parsed.entriesById) {
      return emptyPayload();
    }

    return parsed;
  } catch {
    return emptyPayload();
  }
}

function writePayload(uid: string, payload: StoredSavedListingsPayload): void {
  if (!isListingPrefsStorageAvailable()) {
    return;
  }

  try {
    localStorage.setItem(savedStorageKey(uid), JSON.stringify(payload));
  } catch {
    // Ignore quota errors.
  }
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
  writePayload(uid, { version: 1, orderedIds: nextIds, entriesById: nextEntries });
  return { saved: true, entries: getSavedListings(uid) };
}

export function unsaveListing(uid: string, listingId: string): SavedListingEntry[] {
  const payload = readPayload(uid);
  if (!payload.orderedIds.includes(listingId)) {
    return getSavedListings(uid);
  }

  const nextIds = payload.orderedIds.filter((id) => id !== listingId);
  const nextEntries = { ...payload.entriesById };
  delete nextEntries[listingId];
  writePayload(uid, { version: 1, orderedIds: nextIds, entriesById: nextEntries });
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
