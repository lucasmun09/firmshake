import {
  buildUserCacheKey,
  getCached,
  getStaleCached,
  invalidateCached,
  invalidateCachedNamespace,
  setCached,
} from '@/common/services/responseCache';
import {
  listingSummaryToListing,
  summarizeListings,
  type ListingSummary,
} from '@/features/listings/utils/listingSummary';
import type { Listing, MessageThread } from '@/types';

const THREADS_NAMESPACE = 'tab-inbox-threads';
const SELLING_LISTINGS_NAMESPACE = 'tab-selling-listings';

function reviveThread(thread: MessageThread): MessageThread {
  const lastMessageAt =
    thread.lastMessageAt instanceof Date
      ? thread.lastMessageAt
      : thread.lastMessageAt
        ? new Date(thread.lastMessageAt as unknown as string)
        : undefined;

  return {
    ...thread,
    lastMessageAt,
  };
}

function reviveSummary(summary: ListingSummary): Listing {
  const listing = listingSummaryToListing(summary);
  const createdAt =
    summary.createdAt instanceof Date
      ? summary.createdAt
      : summary.createdAt
        ? new Date(summary.createdAt as unknown as string)
        : undefined;

  return {
    ...listing,
    createdAt,
  };
}

export function inboxThreadsCacheKey(uid: string): string {
  return buildUserCacheKey(uid, THREADS_NAMESPACE, { tab: 'inbox' });
}

export function sellingListingsCacheKey(uid: string): string {
  return buildUserCacheKey(uid, SELLING_LISTINGS_NAMESPACE, { tab: 'selling' });
}

export function getCachedInboxThreads(uid: string): MessageThread[] | null {
  const fresh = getCached<MessageThread[]>(inboxThreadsCacheKey(uid));
  return fresh ? fresh.map(reviveThread) : null;
}

export function getStaleInboxThreads(uid: string): MessageThread[] | null {
  const stale = getStaleCached<MessageThread[]>(inboxThreadsCacheKey(uid));
  return stale ? stale.map(reviveThread) : null;
}

export function setCachedInboxThreads(uid: string, threads: MessageThread[]): void {
  setCached(inboxThreadsCacheKey(uid), threads);
}

export function getCachedSellingListings(uid: string): Listing[] | null {
  const fresh = getCached<ListingSummary[]>(sellingListingsCacheKey(uid));
  return fresh ? fresh.map(reviveSummary) : null;
}

export function getStaleSellingListings(uid: string): Listing[] | null {
  const stale = getStaleCached<ListingSummary[]>(sellingListingsCacheKey(uid));
  return stale ? stale.map(reviveSummary) : null;
}

export function setCachedSellingListings(uid: string, listings: Listing[]): void {
  setCached(sellingListingsCacheKey(uid), summarizeListings(listings));
}

export function invalidateTabFeedCaches(uid: string): void {
  invalidateCached(inboxThreadsCacheKey(uid));
  invalidateCached(sellingListingsCacheKey(uid));
}

export function invalidateAllTabFeedCaches(): void {
  invalidateCachedNamespace(THREADS_NAMESPACE);
  invalidateCachedNamespace(SELLING_LISTINGS_NAMESPACE);
}
