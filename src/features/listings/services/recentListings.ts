import type { Listing, ListingSummary } from '@/types';
import { toListingSummary } from '@/features/listings/utils/listingSummary';

import {
  initListingPrefsStorageOnPageLoad,
  isListingPrefsStorageAvailable,
  listingPrefsStorageKey,
} from '@/features/listings/services/listingPrefsStorage';

const RECENT_NAMESPACE = 'recent-listings';
export const RECENT_LISTINGS_MAX = 50;

export interface RecentListingEntry {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
  viewedAt: number;
}

interface StoredRecentListingsPayload {
  version: 1;
  orderedIds: string[];
  entriesById: Record<string, RecentListingEntry>;
}

function emptyPayload(): StoredRecentListingsPayload {
  return { version: 1, orderedIds: [], entriesById: {} };
}

function recentStorageKey(uid: string): string {
  return listingPrefsStorageKey(uid, RECENT_NAMESPACE);
}

function readPayload(uid: string): StoredRecentListingsPayload {
  if (!isListingPrefsStorageAvailable()) {
    return emptyPayload();
  }

  try {
    const raw = localStorage.getItem(recentStorageKey(uid));
    if (!raw) {
      return emptyPayload();
    }

    const parsed = JSON.parse(raw) as StoredRecentListingsPayload;
    if (parsed.version !== 1 || !Array.isArray(parsed.orderedIds) || !parsed.entriesById) {
      return emptyPayload();
    }

    return parsed;
  } catch {
    return emptyPayload();
  }
}

function writePayload(uid: string, payload: StoredRecentListingsPayload): void {
  if (!isListingPrefsStorageAvailable()) {
    return;
  }

  try {
    localStorage.setItem(recentStorageKey(uid), JSON.stringify(payload));
  } catch {
    // Ignore quota errors.
  }
}

function toRecentEntry(source: Listing | ListingSummary, viewedAt: number): RecentListingEntry {
  const summary = 'imageUrls' in source ? toListingSummary(source) : source;
  return {
    id: summary.id,
    title: summary.title,
    price: summary.price,
    imageUrl: summary.imageUrl,
    viewedAt,
  };
}

export function recordRecentListing(
  uid: string,
  listing: Listing | ListingSummary,
  viewedAt = Date.now(),
): RecentListingEntry[] {
  const payload = readPayload(uid);
  const entry = toRecentEntry(listing, viewedAt);
  const nextIds = [entry.id, ...payload.orderedIds.filter((id) => id !== entry.id)].slice(
    0,
    RECENT_LISTINGS_MAX,
  );
  const nextEntries = { ...payload.entriesById, [entry.id]: entry };

  for (const id of Object.keys(nextEntries)) {
    if (!nextIds.includes(id)) {
      delete nextEntries[id];
    }
  }

  writePayload(uid, { version: 1, orderedIds: nextIds, entriesById: nextEntries });
  return getRecentListings(uid);
}

export function getRecentListings(uid: string): RecentListingEntry[] {
  const payload = readPayload(uid);
  return payload.orderedIds
    .map((id) => payload.entriesById[id])
    .filter((entry): entry is RecentListingEntry => Boolean(entry));
}

export function clearRecentListings(uid: string): void {
  if (!isListingPrefsStorageAvailable()) {
    return;
  }

  try {
    localStorage.removeItem(recentStorageKey(uid));
  } catch {
    // Ignore storage errors.
  }
}

export { initListingPrefsStorageOnPageLoad as initRecentListingsOnPageLoad };
