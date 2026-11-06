import { computed, ref } from 'vue';

import { currentUser } from '@/features/auth/services/auth';
import {
  getRecentListings,
  recordRecentListing,
  type RecentListingEntry,
} from '@/features/listings/services/recentListings';
import { resolveListingPrefsUid } from '@/features/listings/composables/useListingBookmark';
import type { Listing, ListingSummary } from '@/types';

const recentRevision = ref(0);

export function bumpRecentListingsRevision(): void {
  recentRevision.value += 1;
}

export function trackRecentListing(listing: Listing | ListingSummary): RecentListingEntry[] {
  const uid = resolveListingPrefsUid();
  const entries = recordRecentListing(uid, listing);
  bumpRecentListingsRevision();
  return entries;
}

export function useRecentListingsEntries() {
  const uid = computed(() => resolveListingPrefsUid());

  const entries = computed((): RecentListingEntry[] => {
    recentRevision.value;
    currentUser.value?.uid;
    return getRecentListings(uid.value);
  });

  return { entries, refresh: bumpRecentListingsRevision };
}
