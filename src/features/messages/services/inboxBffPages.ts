import type { InboxState, MessageThread } from '@/types';

import type { InboxThreadsPage } from './inboxBff';

/** Default page size for BFF inbox polls (matches API default). */
export const BFF_INBOX_PAGE_SIZE = 30;

/** Cap accumulated pages so a huge inbox cannot hammer the API in one poll. */
export const BFF_INBOX_MAX_PAGES = 10;

export type InboxThreadWithState = MessageThread & { inboxState?: InboxState };

export interface AccumulatedInboxThreads {
  threads: InboxThreadWithState[];
  pagesFetched: number;
  truncated: boolean;
  nextCursor?: string;
}

export type FetchInboxThreadsPage = (options?: {
  cursor?: string;
  limit?: number;
}) => Promise<InboxThreadsPage>;

/**
 * Walk BFF inbox cursor pages until exhausted or maxPages is hit.
 * Pure orchestration — inject `fetchPage` for Vitest.
 */
export async function accumulateInboxThreadPages(
  fetchPage: FetchInboxThreadsPage,
  options?: {
    pageSize?: number;
    maxPages?: number;
  },
): Promise<AccumulatedInboxThreads> {
  const pageSize = options?.pageSize ?? BFF_INBOX_PAGE_SIZE;
  const maxPages = options?.maxPages ?? BFF_INBOX_MAX_PAGES;
  const threads: InboxThreadWithState[] = [];
  let cursor: string | undefined;
  let pagesFetched = 0;
  let truncated = false;
  let nextCursor: string | undefined;

  while (pagesFetched < maxPages) {
    const page = await fetchPage({
      limit: pageSize,
      cursor,
    });
    pagesFetched += 1;
    threads.push(...page.threads);
    nextCursor = page.nextCursor;

    if (!page.hasMore || !page.nextCursor) {
      nextCursor = undefined;
      break;
    }

    if (pagesFetched >= maxPages) {
      truncated = true;
      break;
    }

    cursor = page.nextCursor;
  }

  return { threads, pagesFetched, truncated, nextCursor };
}

/** Strip optional inboxState for UI thread lists that keep a separate state map. */
export function stripInboxStateFromThreads(
  threads: InboxThreadWithState[],
): MessageThread[] {
  return threads.map(({ inboxState: _inboxState, ...thread }) => thread);
}

/** Build inboxState map from BFF-enriched threads (archive / unread without Firestore). */
export function inboxStatesFromBffThreads(
  threads: InboxThreadWithState[],
): Map<string, InboxState> {
  const states = new Map<string, InboxState>();
  for (const thread of threads) {
    if (thread.inboxState) {
      states.set(thread.id, thread.inboxState);
    }
  }
  return states;
}
