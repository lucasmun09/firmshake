/**
 * Inbox threads barrel — re-exports the messaging thread modules.
 * Prefer importing from this file for stable call sites; edit segment files for parallel agents.
 *
 * @see docs/messaging-threads-modules.md
 */

export {
  THREADS_PAGE_SIZE,
  countBuyerThreadsForListing,
  enrichThreads,
  mapThread,
  mergeThreads,
  resolveBuyerFromMessage,
  sellerThreadDocId,
  sortThreads,
  threadFromNotification,
} from '@/features/messages/services/threadModel';

export {
  syncMessageThreadForUser,
  syncMessageThreads,
  writeSellerConversationThread,
} from '@/features/messages/services/threadSync';

export {
  mapWithConcurrency,
  rebuildThreadsForUser,
} from '@/features/messages/services/threadRebuild';

export { subscribeInboxThreads } from '@/features/messages/services/threadSubscribe';
