import {
  SAVED_LISTINGS_MAX,
  type SavedListingEntry,
} from '@/features/listings/services/savedListings';

/**
 * Union local + remote bookmarks by listing id.
 * Newer `savedAt` wins; result sorted newest-first and trimmed to max.
 */
export function mergeSavedListingEntries(
  local: SavedListingEntry[],
  remote: SavedListingEntry[],
  max = SAVED_LISTINGS_MAX,
): SavedListingEntry[] {
  const byId = new Map<string, SavedListingEntry>();

  for (const entry of [...local, ...remote]) {
    if (!entry?.id) {
      continue;
    }

    const existing = byId.get(entry.id);
    if (!existing || entry.savedAt > existing.savedAt) {
      byId.set(entry.id, entry);
    }
  }

  return [...byId.values()]
    .sort((a, b) => b.savedAt - a.savedAt || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, max));
}

/** Entries present in `merged` but missing from `remote` (need upsert). */
export function savedListingsMissingFromRemote(
  merged: SavedListingEntry[],
  remote: SavedListingEntry[],
): SavedListingEntry[] {
  const remoteIds = new Set(remote.map((entry) => entry.id));
  return merged.filter((entry) => !remoteIds.has(entry.id));
}
