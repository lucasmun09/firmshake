import { computed, ref } from 'vue';

import { ALL_COMMUNITY_ID, SEED_COMMUNITIES } from '@/features/communities/data/seedCommunities';
import type { Community, UserProfile } from '@/types';

import { debugLog, serializeError } from '@/common/debug/debugLog';
import {
  ensureCommunitiesSeeded,
  fetchCommunities,
} from '@/features/communities/services/communities';
import { useBffBrowse } from '@/common/config/featureFlags';
import { ensureCategoriesSeeded } from '@/features/listings/services/categories';
import {
  handleFirestorePermissionDenied,
  isSessionExpiredError,
  waitForFirestoreAuthNavigation,
} from '@/common/services/firestoreAuth';
import {
  buildUserCacheKey,
  clearCacheIfUserChanged,
  getStaleCached,
  setCached,
} from '@/common/services/responseCache';
import { clearBrowseLocalCacheIfUserChanged } from '@/features/listings/services/browseLocalStorageCache';
import { clearGeoFilterPrefsIfUserChanged } from '@/features/listings/services/geoFilterStorage';
import { scheduleTabPrefetch, stopTabFeedPrefetch } from '@/common/services/tabPrefetch';
import { subscribeUserProfile } from '@/common/services/users';

const BOOTSTRAP_WAIT_TIMEOUT_MS = 4_000;
const PROFILE_READY_FALLBACK_MS = 2_000;

export const bootstrapCommunities = ref<Community[]>([]);
export const bootstrapProfile = ref<UserProfile | null>(null);
export const communitiesReady = ref(false);
export const profileReady = ref(false);
export const bootstrapRefreshing = ref(false);

export const bootstrapReady = computed(
  () => communitiesReady.value && profileReady.value,
);

let unsubscribeProfile: (() => void) | undefined;
let profileFallbackTimer: number | undefined;
let bootstrapPromise: Promise<void> | undefined;

function profileCacheKey(uid: string): string {
  return buildUserCacheKey(uid, 'profile', { tab: 'bootstrap' });
}

export function hydrateBootstrapFromCache(uid?: string): boolean {
  let hydrated = false;

  const cachedCommunities = getStaleCached<Community[]>('communities:tab=all');
  if (cachedCommunities && cachedCommunities.length > 0) {
    bootstrapCommunities.value = cachedCommunities;
    communitiesReady.value = true;
    hydrated = true;
  }

  if (uid) {
    const cachedProfile = getStaleCached<UserProfile>(profileCacheKey(uid));
    if (cachedProfile) {
      bootstrapProfile.value = cachedProfile;
      profileReady.value = true;
      hydrated = true;
    }
  }

  return hydrated;
}

export async function startGuestBootstrap(): Promise<void> {
  if (bootstrapPromise) {
    await bootstrapPromise;
    return;
  }

  bootstrapPromise = runGuestBootstrap();
  await bootstrapPromise;
  bootstrapPromise = undefined;
}

async function runGuestBootstrap(): Promise<void> {
  profileReady.value = true;
  bootstrapProfile.value = null;

  const hadCommunitiesCache = hydrateBootstrapFromCache();

  if (!hadCommunitiesCache) {
    communitiesReady.value = false;
  }

  if (!useBffBrowse()) {
    void ensureCategoriesSeeded().catch((error) => {
      if (isSessionExpiredError(error)) {
        return;
      }
      void handleFirestorePermissionDenied(error, 'ensureCategoriesSeeded').then((handled) => {
        if (!handled) {
          console.warn('Category seed failed', error);
        }
      });
    });
  }

  await (hadCommunitiesCache ? refreshCommunitiesInBackground() : loadCommunities());
}

export async function startAppBootstrap(uid: string): Promise<void> {
  if (bootstrapPromise) {
    await bootstrapPromise;
    return;
  }

  bootstrapPromise = runBootstrap(uid);
  await bootstrapPromise;
  bootstrapPromise = undefined;
}

async function runBootstrap(uid: string): Promise<void> {
  clearCacheIfUserChanged(uid);
  clearBrowseLocalCacheIfUserChanged(uid);
  clearGeoFilterPrefsIfUserChanged(uid);

  const hadCommunitiesCache = hydrateBootstrapFromCache(uid);

  unsubscribeProfile?.();
  unsubscribeProfile = undefined;
  if (profileFallbackTimer !== undefined) {
    window.clearTimeout(profileFallbackTimer);
    profileFallbackTimer = undefined;
  }

  if (!hadCommunitiesCache) {
    communitiesReady.value = false;
  }
  if (!bootstrapProfile.value) {
    profileReady.value = false;
  }

  try {
    await waitForFirestoreAuthNavigation();
  } catch (err) {
    if (isSessionExpiredError(err)) {
      return;
    }
    // Bootstrap still proceeds; individual reads retry once auth propagates.
  }

  profileFallbackTimer = window.setTimeout(() => {
    if (!profileReady.value) {
      debugLog.warn('bootstrap', 'Profile subscription slow; proceeding without profile');
      profileReady.value = true;
    }
  }, PROFILE_READY_FALLBACK_MS);

  unsubscribeProfile = subscribeUserProfile(uid, (profile) => {
    if (profileFallbackTimer !== undefined) {
      window.clearTimeout(profileFallbackTimer);
      profileFallbackTimer = undefined;
    }
    bootstrapProfile.value = profile;
    profileReady.value = true;
    setCached(profileCacheKey(uid), profile);
  });

  const communitiesTask = hadCommunitiesCache
    ? refreshCommunitiesInBackground()
    : loadCommunities();

  if (!useBffBrowse()) {
    void ensureCategoriesSeeded().catch((error) => {
      if (isSessionExpiredError(error)) {
        return;
      }
      void handleFirestorePermissionDenied(error, 'ensureCategoriesSeeded').then((handled) => {
        if (!handled) {
          console.warn('Category seed failed', error);
        }
      });
    });
  }

  await communitiesTask;

  scheduleTabPrefetch(uid);
}

async function loadCommunities(): Promise<void> {
  try {
    await ensureCommunitiesSeeded();
    bootstrapCommunities.value = await fetchCommunities();

    if (bootstrapCommunities.value.length === 0) {
      debugLog.warn('bootstrap', 'Communities empty after fetch; retrying seed and refresh');
      await ensureCommunitiesSeeded();
      bootstrapCommunities.value = await fetchCommunities({ forceRefresh: true });
    }

    if (bootstrapCommunities.value.length === 0) {
      debugLog.warn('bootstrap', 'Communities still empty; using seed fallback for browse UI');
      bootstrapCommunities.value = [...SEED_COMMUNITIES];
    }
  } catch (err) {
    if (isSessionExpiredError(err)) {
      return;
    }
    debugLog.warn('bootstrap', 'Communities bootstrap failed; using seed fallback', {
      error: serializeError(err),
    });
    if (bootstrapCommunities.value.length === 0) {
      bootstrapCommunities.value = [...SEED_COMMUNITIES];
    }
  } finally {
    communitiesReady.value = true;
  }
}

async function refreshCommunitiesInBackground(): Promise<void> {
  bootstrapRefreshing.value = true;

  try {
    await ensureCommunitiesSeeded();
    const fresh = await fetchCommunities({ forceRefresh: true });

    if (fresh.length > 0) {
      bootstrapCommunities.value = fresh;
    } else if (bootstrapCommunities.value.length === 0) {
      bootstrapCommunities.value = [...SEED_COMMUNITIES];
    }
  } catch (err) {
    if (isSessionExpiredError(err)) {
      return;
    }
    debugLog.warn('bootstrap', 'Background communities refresh failed', {
      error: serializeError(err),
    });
    if (bootstrapCommunities.value.length === 0) {
      bootstrapCommunities.value = [...SEED_COMMUNITIES];
    }
  } finally {
    communitiesReady.value = true;
    bootstrapRefreshing.value = false;
  }
}

export function stopAppBootstrap(): void {
  stopTabFeedPrefetch();
  unsubscribeProfile?.();
  unsubscribeProfile = undefined;
  if (profileFallbackTimer !== undefined) {
    window.clearTimeout(profileFallbackTimer);
    profileFallbackTimer = undefined;
  }
  bootstrapCommunities.value = [];
  bootstrapProfile.value = null;
  communitiesReady.value = false;
  profileReady.value = false;
  bootstrapRefreshing.value = false;
  bootstrapPromise = undefined;
}

export async function refreshBootstrapCommunities(): Promise<Community[]> {
  const communities = await fetchCommunities({ forceRefresh: true });
  bootstrapCommunities.value = communities;
  communitiesReady.value = true;
  return communities;
}

export async function waitForBootstrap(): Promise<void> {
  if (bootstrapReady.value) {
    return;
  }

  await new Promise<void>((resolve) => {
    const deadline = Date.now() + BOOTSTRAP_WAIT_TIMEOUT_MS;
    const interval = window.setInterval(() => {
      if (bootstrapReady.value) {
        window.clearInterval(interval);
        resolve();
        return;
      }

      if (Date.now() >= deadline) {
        window.clearInterval(interval);
        debugLog.warn('bootstrap', 'waitForBootstrap timed out; proceeding with fallbacks');
        if (!communitiesReady.value) {
          communitiesReady.value = true;
          if (bootstrapCommunities.value.length === 0) {
            bootstrapCommunities.value = [...SEED_COMMUNITIES];
          }
        }
        if (!profileReady.value) {
          profileReady.value = true;
        }
        resolve();
      }
    }, 50);
  });
}

export function getJoinedCommunities(profile: UserProfile | null): Community[] {
  const joinedIds = new Set(profile?.communityIds ?? [ALL_COMMUNITY_ID]);
  const available =
    bootstrapCommunities.value.length > 0 ? bootstrapCommunities.value : SEED_COMMUNITIES;
  return available.filter((community) => joinedIds.has(community.id));
}
