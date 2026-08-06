import {
  archiveInboxThreadViaBff,
  fetchInboxThreadsViaBff,
  markInboxThreadReadViaBff,
  unarchiveInboxThreadViaBff,
} from '@/common/services/api';
import type { InboxState, MessageThread } from '@/types';

import { inboxStateDocId } from './inboxState';

export interface InboxThreadsPage {
  threads: Array<MessageThread & { inboxState?: InboxState }>;
  nextCursor?: string;
  hasMore: boolean;
}

/** Fetch paginated enriched inbox threads via firmshake-api. */
export async function fetchInboxThreads(options?: {
  cursor?: string;
  limit?: number;
}): Promise<InboxThreadsPage> {
  const page = await fetchInboxThreadsViaBff(options);
  return {
    threads: page.threads.map(({ inboxState, ...thread }) => ({
      ...thread,
      inboxState,
    })),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

/** Mark a thread read via firmshake-api (updates inboxState server-side). */
export async function markConversationRead(
  listingId: string,
  buyerId?: string,
): Promise<InboxState> {
  const threadKey = inboxStateDocId(listingId, buyerId);
  return markInboxThreadReadViaBff(threadKey);
}

/** Archive a thread via firmshake-api. */
export async function archiveConversation(
  listingId: string,
  buyerId?: string,
): Promise<InboxState> {
  const threadKey = inboxStateDocId(listingId, buyerId);
  return archiveInboxThreadViaBff(threadKey);
}

/** Unarchive a thread via firmshake-api. */
export async function unarchiveConversation(
  listingId: string,
  buyerId?: string,
): Promise<InboxState> {
  const threadKey = inboxStateDocId(listingId, buyerId);
  return unarchiveInboxThreadViaBff(threadKey);
}
