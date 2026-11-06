import { debugLog, serializeError } from '@/common/debug/debugLog';
import {
  getSavedListings,
  setSavedListings,
  type SavedListingEntry,
} from '@/features/listings/services/savedListings';
import {
  mergeSavedListingEntries,
  savedListingsMissingFromRemote,
} from '@/features/listings/services/savedListingsMerge';
import {
  canSyncSavedListingsRemote,
  deleteSavedListingRemote,
  fetchSavedListingsRemote,
  upsertSavedListingRemote,
} from '@/features/listings/services/savedListingsRemote';

export function canSyncSavedListings(uid: string): boolean {
  return canSyncSavedListingsRemote(uid);
}

/**
 * Pull remote bookmarks, merge with local cache, write local, push local-only rows.
 * Safe to call on every signed-in bootstrap; no-op for anonymous / missing Firestore.
 */
export async function hydrateSavedListingsFromRemote(uid: string): Promise<SavedListingEntry[]> {
  if (!canSyncSavedListings(uid)) {
    return getSavedListings(uid);
  }

  debugLog.info('saved-listings', 'hydrate.start', { uid });

  try {
    const remote = await fetchSavedListingsRemote(uid);
    const local = getSavedListings(uid);
    const merged = mergeSavedListingEntries(local, remote);
    setSavedListings(uid, merged);

    const missing = savedListingsMissingFromRemote(merged, remote);
    for (const entry of missing) {
      await upsertSavedListingRemote(uid, entry);
    }

    debugLog.info('saved-listings', 'hydrate.done', {
      uid,
      localCount: local.length,
      remoteCount: remote.length,
      mergedCount: merged.length,
      pushedCount: missing.length,
    });

    return merged;
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
      await deleteSavedListingRemote(uid, listingId);
    }

    debugLog.debug('saved-listings', 'toggle.sync', { uid, listingId, saved });
  } catch (error) {
    debugLog.warn('saved-listings', 'toggle.sync.failed', {
      uid,
      listingId,
      saved,
      error: serializeError(error),
    });
  }
}
