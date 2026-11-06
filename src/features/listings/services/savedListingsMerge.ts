import {
  SAVED_LISTINGS_MAX,
  type SavedListingEntry,
  type SavedListingTombstone,
} from '@/features/listings/services/savedListings';

export interface SavedListingsMergeResult {
  entries: SavedListingEntry[];
  tombstones: SavedListingTombstone[];
  /** Active bookmarks that need a remote upsert (local-only or beating a remote tombstone). */
  toUpsert: SavedListingEntry[];
  /** Deletes that need a remote soft-tombstone write. */
  toTombstone: SavedListingTombstone[];
}

function bestById<T extends { id: string }>(
  items: T[],
  pickNewer: (a: T, b: T) => T,
): Map<string, T> {
  const byId = new Map<string, T>();
  for (const item of items) {
    if (!item?.id) {
      continue;
    }
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }
    byId.set(item.id, pickNewer(existing, item));
  }
  return byId;
}

/**
 * Union local + remote bookmarks by listing id.
 * Newer `savedAt` wins; result sorted newest-first and trimmed to max.
 * Tombstone-unaware helper kept for simple callers/tests.
 */
export function mergeSavedListingEntries(
  local: SavedListingEntry[],
  remote: SavedListingEntry[],
  max = SAVED_LISTINGS_MAX,
): SavedListingEntry[] {
  return mergeSavedListingsState(local, [], remote, [], max).entries;
}

/**
 * Last-write-wins merge across active bookmarks and delete tombstones.
 * A tombstone wins when `deletedAt >= savedAt` for that listing id.
 */
export function mergeSavedListingsState(
  localEntries: SavedListingEntry[],
  localTombstones: SavedListingTombstone[],
  remoteEntries: SavedListingEntry[],
  remoteTombstones: SavedListingTombstone[],
  max = SAVED_LISTINGS_MAX,
): SavedListingsMergeResult {
  const saves = bestById([...localEntries, ...remoteEntries], (a, b) =>
    b.savedAt > a.savedAt ? b : a,
  );
  const tombs = bestById([...localTombstones, ...remoteTombstones], (a, b) =>
    b.deletedAt > a.deletedAt ? b : a,
  );

  const allIds = new Set([...saves.keys(), ...tombs.keys()]);
  const winningEntries: SavedListingEntry[] = [];
  const winningTombstones: SavedListingTombstone[] = [];

  for (const id of allIds) {
    const save = saves.get(id);
    const tomb = tombs.get(id);
    const deleteWins = Boolean(tomb && (!save || tomb.deletedAt >= save.savedAt));

    if (deleteWins && tomb) {
      winningTombstones.push(tomb);
    } else if (save) {
      winningEntries.push(save);
    }
  }

  const entries = winningEntries
    .sort((a, b) => b.savedAt - a.savedAt || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, max));

  const entryIds = new Set(entries.map((entry) => entry.id));
  const tombstones = winningTombstones
    .filter((tombstone) => !entryIds.has(tombstone.id))
    .sort((a, b) => b.deletedAt - a.deletedAt || a.id.localeCompare(b.id));

  const remoteSaveById = new Map(remoteEntries.map((entry) => [entry.id, entry]));
  const remoteTombById = new Map(remoteTombstones.map((tombstone) => [tombstone.id, tombstone]));

  const toUpsert = entries.filter((entry) => {
    const remoteSave = remoteSaveById.get(entry.id);
    const remoteTomb = remoteTombById.get(entry.id);
    if (remoteTomb && remoteTomb.deletedAt >= entry.savedAt) {
      // Should not happen for winners; defensive skip.
      return false;
    }
    if (!remoteSave) {
      return true;
    }
    return entry.savedAt > remoteSave.savedAt;
  });

  // Push soft deletes until remote has the same-or-newer tombstone (propagates to peers).
  const toTombstone = tombstones.filter((tombstone) => {
    const remoteTomb = remoteTombById.get(tombstone.id);
    if (remoteTomb && remoteTomb.deletedAt >= tombstone.deletedAt) {
      return false;
    }
    return true;
  });

  return { entries, tombstones, toUpsert, toTombstone };
}

/** Entries present in `merged` but missing from `remote` (need upsert). */
export function savedListingsMissingFromRemote(
  merged: SavedListingEntry[],
  remote: SavedListingEntry[],
): SavedListingEntry[] {
  const remoteIds = new Set(remote.map((entry) => entry.id));
  return merged.filter((entry) => !remoteIds.has(entry.id));
}
