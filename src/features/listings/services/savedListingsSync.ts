import { debugLog, serializeError } from '@/common/debug/debugLog';
import {
  getSavedListingTombstones,
  getSavedListings,
  setSavedListingsState,
  type SavedListingEntry,
} from '@/features/listings/services/savedListings';
import { mergeSavedListingsState } from '@/features/listings/services/savedListingsMerge';
import {
  canSyncSavedListingsRemote,
  fetchSavedListingsRemoteState,
  tombstoneSavedListingRemote,
  upsertSavedListingRemote,
} from '@/features/listings/services/savedListingsRemote';

export function canSyncSavedListings(uid: string): boolean {
  return canSyncSavedListingsRemote(uid);
}

/**
 * Pull remote bookmarks + tombstones, LWW-merge with local, write local, push gaps.
 * Safe to call on every signed-in bootstrap; no-op for anonymous / missing Firestore.
 */
export async function hydrateSavedListingsFromRemote(uid: string): Promise<SavedListingEntry[]> {
  if (!canSyncSavedListings(uid)) {
    return getSavedListings(uid);
  }

  debugLog.info('saved-listings', 'hydrate.start', { uid });

  try {
    const remote = await fetchSavedListingsRemoteState(uid);
    const local = getSavedListings(uid);
    const localTombstones = getSavedListingTombstones(uid);
    const merged = mergeSavedListingsState(
      local,
      localTombstones,
      remote.entries,
      remote.tombstones,
    );

    setSavedListingsState(uid, merged.entries, merged.tombstones);

    for (const entry of merged.toUpsert) {
      await upsertSavedListingRemote(uid, entry);
    }
    for (const tombstone of merged.toTombstone) {
      await tombstoneSavedListingRemote(uid, tombstone.id, tombstone.deletedAt);
    }

    debugLog.info('saved-listings', 'hydrate.done', {
      uid,
      localCount: local.length,
      localTombstoneCount: localTombstones.length,
      remoteCount: remote.entries.length,
      remoteTombstoneCount: remote.tombstones.length,
      mergedCount: merged.entries.length,
      mergedTombstoneCount: merged.tombstones.length,
      upsertedCount: merged.toUpsert.length,
      tombstonedCount: merged.toTombstone.length,
    });

    return merged.entries;
  } catch (error) {
    debugLog.warn('saved-listings', 'hydrate.failed', {
      uid,
      error: serializeError(error),
    });
    return getSavedListings(uid);
  }
}

/** Push a single toggle to Firestore after optimistic local write. */
export async function syncSavedListingToggleRemote(
  uid: string,
  listingId: string,
  saved: boolean,
  entry?: SavedListingEntry | null,
  deletedAt = Date.now(),
): Promise<void> {
  if (!canSyncSavedListings(uid) || !listingId) {
    return;
  }

  try {
    if (saved) {
      const resolved =
        entry ?? getSavedListings(uid).find((item) => item.id === listingId) ?? null;
      if (!resolved) {
        return;
      }
      await upsertSavedListingRemote(uid, resolved);
    } else {
      const localTombstone = getSavedListingTombstones(uid).find((item) => item.id === listingId);
      await tombstoneSavedListingRemote(
        uid,
        listingId,
        localTombstone?.deletedAt ?? deletedAt,
      );
    }

    debugLog.debug('saved-listings', 'toggle.sync', { uid, listingId, saved, deletedAt });
  } catch (error) {
    debugLog.warn('saved-listings', 'toggle.sync.failed', {
      uid,
      listingId,
      saved,
      error: serializeError(error),
    });
  }
}
