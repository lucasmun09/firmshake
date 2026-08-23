import { computed, ref } from 'vue';
import { toastController } from '@ionic/vue';

import { getCacheOwnerUid } from '@/common/services/responseCache';
import { currentUser } from '@/features/auth/services/auth';
import {
  getSavedListings,
  isListingSaved,
  toggleSavedListing,
  type SavedListingEntry,
} from '@/features/listings/services/savedListings';
import type { Listing, ListingSummary } from '@/types';

const savedRevision = ref(0);

export const savedListingsRevision = savedRevision;

export function bumpSavedListingsRevision(): void {
  savedRevision.value += 1;
}

export function resolveListingPrefsUid(): string {
  return currentUser.value?.uid ?? getCacheOwnerUid() ?? 'anonymous';
}

export function useListingBookmark(listingId: () => string) {
  const uid = computed(() => resolveListingPrefsUid());

  const isSaved = computed(() => {
    savedRevision.value;
    return isListingSaved(uid.value, listingId());
  });

  async function toggleBookmark(
    listing: Listing | ListingSummary,
  ): Promise<{ saved: boolean; atCapacity?: boolean }> {
    const previousSaved = isListingSaved(uid.value, listing.id);
    const result = toggleSavedListing(uid.value, listing);
    bumpSavedListingsRevision();

    if (!previousSaved && !result.saved) {
      const toast = await toastController.create({
        message: 'Saved listings limit reached (50). Remove one to save more.',
        duration: 3000,
        position: 'top',
        color: 'warning',
      });
      await toast.present();
      return { saved: false, atCapacity: true };
    }

    const toast = await toastController.create({
      message: result.saved ? 'Listing saved' : 'Removed from saved',
      duration: 2500,
      position: 'top',
      color: result.saved ? 'success' : 'medium',
    });
    await toast.present();
    return { saved: result.saved };
  }

  return {
    isSaved,
    toggleBookmark,
  };
}

export function useSavedListingsEntries() {
  const uid = computed(() => resolveListingPrefsUid());

  const entries = computed((): SavedListingEntry[] => {
    savedRevision.value;
    return getSavedListings(uid.value);
  });

  return { entries, refresh: bumpSavedListingsRevision };
}
