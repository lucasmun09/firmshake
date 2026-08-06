import { debugLog, serializeError } from '@/common/debug/debugLog';
import { isDirectTabFeedPath, isWithinTabsShell } from '@/router/tabsRoute';
import { waitForFirestoreAuthNavigation } from '@/common/services/firestoreAuth';
import {
  setCachedInboxThreads,
  setCachedSellingListings,
} from '@/common/services/tabFeedCache';
import { isSessionExpiredError } from '@/features/auth/services/sessionExpiry';
import { subscribeSellerListings } from '@/features/listings/services/listings';
import { subscribeInboxThreads } from '@/features/messages/services/threads';

const IDLE_FALLBACK_MS = 1_500;

let chunkPrefetchStarted = false;
let feedPrefetchUid: string | null = null;
let unsubscribeInboxThreads: (() => void) | undefined;
let unsubscribeSellingListings: (() => void) | undefined;

function scheduleWhenIdle(task: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(task, { timeout: IDLE_FALLBACK_MS });
    return;
  }

  window.setTimeout(task, 0);
}

/** Prefetch lazy route chunks for Buying, Selling, and Inbox tabs. */
export function prefetchTabRouteChunks(): void {
  if (chunkPrefetchStarted) {
    return;
  }

  chunkPrefetchStarted = true;
  debugLog.debug('prefetch', 'Prefetching tab route chunks');

  void Promise.all([
    import('@/features/buying/views/BuyingPage.vue'),
    import('@/features/selling/views/SellingPage.vue'),
    import('@/features/messages/views/InboxPage.vue'),
    import('@/features/messages/components/ListingThreadActions.vue'),
    import('@/components/skeletons/ThreadRowSkeleton.vue'),
    import('@/components/skeletons/ListingRowSkeleton.vue'),
  ])
    .then(() => {
      debugLog.debug('prefetch', 'Tab route chunks prefetched');
    })
    .catch((err) => {
      chunkPrefetchStarted = false;
      debugLog.warn('prefetch', 'Tab route chunk prefetch failed', {
        error: serializeError(err),
      });
    });
}

/** Warm inbox/selling caches via background Firestore subscriptions. */
export function startTabFeedPrefetch(uid: string): void {
  if (feedPrefetchUid === uid && unsubscribeInboxThreads) {
    return;
  }

  stopTabFeedPrefetch();
  feedPrefetchUid = uid;

  debugLog.debug('prefetch', 'Starting tab feed prefetch', { uid });

  void waitForFirestoreAuthNavigation()
    .then(() => {
      if (feedPrefetchUid !== uid) {
        return;
      }

      unsubscribeInboxThreads = subscribeInboxThreads(
        uid,
        (threads) => {
          setCachedInboxThreads(uid, threads);
          debugLog.debug('prefetch', 'Inbox threads cache warmed', {
            uid,
            count: threads.length,
          });
        },
        (err) => {
          if (!isSessionExpiredError(err)) {
            debugLog.debug('prefetch', 'Inbox threads prefetch subscription error', {
              error: serializeError(err),
            });
          }
        },
      );

      unsubscribeSellingListings = subscribeSellerListings(
        uid,
        (listings) => {
          setCachedSellingListings(uid, listings);
          debugLog.debug('prefetch', 'Selling listings cache warmed', {
            uid,
            count: listings.length,
          });
        },
        (err) => {
          if (!isSessionExpiredError(err)) {
            debugLog.debug('prefetch', 'Selling listings prefetch subscription error', {
              error: serializeError(err),
            });
          }
        },
      );
    })
    .catch((err) => {
      if (!isSessionExpiredError(err)) {
        debugLog.warn('prefetch', 'Tab feed prefetch auth failed', {
          error: serializeError(err),
        });
      }
    });
}

export function stopTabFeedPrefetch(): void {
  unsubscribeInboxThreads?.();
  unsubscribeInboxThreads = undefined;
  unsubscribeSellingListings?.();
  unsubscribeSellingListings = undefined;
  feedPrefetchUid = null;
}

/** Defer chunk + feed prefetch until the browser is idle (after home is visible). */
export function scheduleTabPrefetch(uid: string): void {
  scheduleWhenIdle(() => {
    prefetchTabRouteChunks();
    startTabFeedPrefetch(uid);
  });
}

/** Eager prefetch when the user lands directly on a tab URL (before TabsPage mounts). */
export function bootstrapDirectTabEntry(pathname: string, uid?: string): void {
  if (!isWithinTabsShell(pathname)) {
    return;
  }

  prefetchTabRouteChunks();

  if (uid && isDirectTabFeedPath(pathname)) {
    startTabFeedPrefetch(uid);
  }
}
