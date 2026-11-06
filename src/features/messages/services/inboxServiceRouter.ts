/**
 * Routes inbox thread fetch and read/archive mutations to Firestore or firmshake-api.
 */
import type { Unsubscribe } from 'firebase/firestore';

import { useBffInbox } from '@/common/config/featureFlags';
import { debugLog, serializeError } from '@/common/debug/debugLog';
import type { InboxState, MessageThread } from '@/types';

import * as inboxBff from './inboxBff';
import {
  accumulateInboxThreadPages,
  BFF_INBOX_PAGE_SIZE,
  inboxStatesFromBffThreads,
  stripInboxStateFromThreads,
} from './inboxBffPages';
import * as inboxFirestoreWrites from './inboxFirestoreWrites';
import { subscribeInboxThreads } from './threads';

const BFF_INBOX_POLL_MS = 30_000;

export function shouldRouteInboxViaBff(): boolean {
  return useBffInbox();
}

export async function routeMarkConversationViewed(
  userId: string,
  listingId: string,
  buyerId?: string,
): Promise<void> {
  if (useBffInbox()) {
    await inboxBff.markConversationRead(listingId, buyerId);
    return;
  }
  await inboxFirestoreWrites.markConversationViewed(userId, listingId, buyerId);
}

export async function routeArchiveConversation(
  userId: string,
  listingId: string,
  buyerId?: string,
): Promise<void> {
  if (useBffInbox()) {
    await inboxBff.archiveConversation(listingId, buyerId);
    return;
  }
  await inboxFirestoreWrites.archiveConversation(userId, listingId, buyerId);
}

export async function routeUnarchiveConversation(
  userId: string,
  listingId: string,
  buyerId?: string,
): Promise<void> {
  if (useBffInbox()) {
    await inboxBff.unarchiveConversation(listingId, buyerId);
    return;
  }
  await inboxFirestoreWrites.unarchiveConversation(userId, listingId, buyerId);
}

export async function routeFetchInboxThreads(options?: {
  cursor?: string;
  limit?: number;
}) {
  if (useBffInbox()) {
    return inboxBff.fetchInboxThreads(options);
  }
  return null;
}

export type InboxThreadsSubscribeHandlers = {
  onData: (threads: MessageThread[]) => void;
  onError?: (error: Error) => void;
  /** Optional: seed archive/unread map from BFF-enriched inboxState. */
  onInboxStates?: (states: Map<string, InboxState>) => void;
};

/** Subscribe to inbox threads — Firestore listeners by default, BFF polling when flag is on. */
export function subscribeInboxThreadsRouted(
  userId: string,
  onDataOrHandlers: ((threads: MessageThread[]) => void) | InboxThreadsSubscribeHandlers,
  onError?: (error: Error) => void,
): Unsubscribe {
  const handlers: InboxThreadsSubscribeHandlers =
    typeof onDataOrHandlers === 'function'
      ? { onData: onDataOrHandlers, onError }
      : onDataOrHandlers;

  if (!useBffInbox()) {
    return subscribeInboxThreads(userId, handlers.onData, handlers.onError);
  }

  let cancelled = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  const refresh = async () => {
    try {
      const accumulated = await accumulateInboxThreadPages(inboxBff.fetchInboxThreads, {
        pageSize: BFF_INBOX_PAGE_SIZE,
      });
      if (cancelled) {
        return;
      }
      debugLog.debug('inbox', 'bff.poll.done', {
        userId,
        count: accumulated.threads.length,
        pagesFetched: accumulated.pagesFetched,
        truncated: accumulated.truncated,
      });
      handlers.onData(stripInboxStateFromThreads(accumulated.threads));
      if (handlers.onInboxStates) {
        handlers.onInboxStates(inboxStatesFromBffThreads(accumulated.threads));
      }
    } catch (error) {
      debugLog.warn('inbox', 'bff.poll.failed', {
        userId,
        error: serializeError(error),
      });
      if (!cancelled) {
        handlers.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    }
  };

  void refresh();
  pollTimer = setInterval(() => void refresh(), BFF_INBOX_POLL_MS);

  return () => {
    cancelled = true;
    if (pollTimer) {
      clearInterval(pollTimer);
    }
  };
}
