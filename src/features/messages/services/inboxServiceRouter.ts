/**
 * Routes inbox thread fetch and read/archive mutations to Firestore or firmshake-api.
 */
import type { Unsubscribe } from 'firebase/firestore';

import { useBffInbox } from '@/common/config/featureFlags';
import type { MessageThread } from '@/types';

import * as inboxBff from './inboxBff';
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

/** Subscribe to inbox threads — Firestore listeners by default, BFF polling when flag is on. */
export function subscribeInboxThreadsRouted(
  userId: string,
  onData: (threads: MessageThread[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!useBffInbox()) {
    return subscribeInboxThreads(userId, onData, onError);
  }

  let cancelled = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  const refresh = async () => {
    try {
      const page = await inboxBff.fetchInboxThreads({ limit: 30 });
      if (cancelled) {
        return;
      }
      onData(
        page.threads.map(({ inboxState: _inboxState, ...thread }) => thread),
      );
    } catch (error) {
      if (!cancelled) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
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
