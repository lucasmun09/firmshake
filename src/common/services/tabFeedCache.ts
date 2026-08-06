import {
  buildUserCacheKey,
  getCached,
  getStaleCached,
  invalidateCached,
  invalidateCachedNamespace,
  setCached,
} from '@/common/services/responseCache';
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

function reviveListing(listing: Listing): Listing {
  const createdAt =
    listing.createdAt instanceof Date
      ? listing.createdAt
      : listing.createdAt
        ? new Date(listing.createdAt as unknown as string)
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
  const fresh = getCached<Listing[]>(sellingListingsCacheKey(uid));
  return fresh ? fresh.map(reviveListing) : null;
}

export function getStaleSellingListings(uid: string): Listing[] | null {
  const stale = getStaleCached<Listing[]>(sellingListingsCacheKey(uid));
  return stale ? stale.map(reviveListing) : null;
}

export function setCachedSellingListings(uid: string, listings: Listing[]): void {
  setCached(sellingListingsCacheKey(uid), listings);
}

export function invalidateTabFeedCaches(uid: string): void {
  invalidateCached(inboxThreadsCacheKey(uid));
  invalidateCached(sellingListingsCacheKey(uid));
}

export function invalidateAllTabFeedCaches(): void {
  invalidateCachedNamespace(THREADS_NAMESPACE);
  invalidateCachedNamespace(SELLING_LISTINGS_NAMESPACE);
}
