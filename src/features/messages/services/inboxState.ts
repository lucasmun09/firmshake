import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import type { InboxState } from '@/types';
import { db } from '@/common/services/firebase';

export function inboxStateDocId(listingId: string, buyerId?: string): string {
  return buyerId ? `${listingId}_${buyerId}` : listingId;
}

function mapTimestamp(value: unknown): Date | undefined {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return undefined;
}

function mapInboxState(id: string, data: Record<string, unknown>): InboxState {
  return {
    listingId: String(data.listingId ?? id.split('_')[0] ?? id),
    buyerId: data.buyerId ? String(data.buyerId) : undefined,
    lastReadAt: mapTimestamp(data.lastReadAt),
    hasViewed: Boolean(data.hasViewed),
    isArchived: Boolean(data.isArchived),
    archivedAt: mapTimestamp(data.archivedAt),
  };
}

export function subscribeInboxStates(
  userId: string,
  onData: (states: Map<string, InboxState>) => void,
): Unsubscribe {
  if (!db) {
    onData(new Map());
    return () => undefined;
  }

  return onSnapshot(collection(db, 'users', userId, 'inboxState'), (snapshot) => {
    const states = new Map<string, InboxState>();
    for (const entry of snapshot.docs) {
      states.set(entry.id, mapInboxState(entry.id, entry.data()));
    }
    onData(states);
  });
}

export function isConversationArchived(
  states: Map<string, InboxState>,
  listingId: string,
  buyerId?: string,
): boolean {
  const stateId = inboxStateDocId(listingId, buyerId);
  return Boolean(states.get(stateId)?.isArchived);
}

export function partitionByArchive<T extends { listingId: string; buyerId?: string }>(
  items: T[],
  states: Map<string, InboxState>,
): { active: T[]; archived: T[] } {
  const active: T[] = [];
  const archived: T[] = [];

  for (const item of items) {
    if (isConversationArchived(states, item.listingId, item.buyerId)) {
      archived.push(item);
    } else {
      active.push(item);
    }
  }

  return { active, archived };
}

export function hasArchivedConversations(states: Map<string, InboxState>): boolean {
  for (const state of states.values()) {
    if (state.isArchived) {
      return true;
    }
  }
  return false;
}

export function isThreadUnread(
  thread: {
    listingId: string;
    buyerId?: string;
    lastMessageAt?: Date;
    lastMessageSenderId?: string;
  },
  states: Map<string, InboxState>,
  currentUserId: string,
): boolean {
  if (isConversationArchived(states, thread.listingId, thread.buyerId)) {
    return false;
  }

  if (thread.lastMessageSenderId === currentUserId) {
    return false;
  }

  const stateId = inboxStateDocId(thread.listingId, thread.buyerId);
  const state = states.get(stateId);
  if (!state?.lastReadAt) {
    return Boolean(thread.lastMessageAt);
  }

  const lastReadTime = state.lastReadAt.getTime();
  const messageTime = thread.lastMessageAt?.getTime() ?? 0;
  return messageTime > lastReadTime;
}

export async function markConversationViewed(
  userId: string,
  listingId: string,
  buyerId?: string,
): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  const docId = inboxStateDocId(listingId, buyerId);
  await setDoc(
    doc(db, 'users', userId, 'inboxState', docId),
    {
      listingId,
      buyerId: buyerId ?? null,
      lastReadAt: serverTimestamp(),
      hasViewed: true,
    },
    { merge: true },
  );
}

export async function archiveConversation(
  userId: string,
  listingId: string,
  buyerId?: string,
): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  const docId = inboxStateDocId(listingId, buyerId);
  await setDoc(
    doc(db, 'users', userId, 'inboxState', docId),
    {
      listingId,
      buyerId: buyerId ?? null,
      isArchived: true,
      archivedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function unarchiveConversation(
  userId: string,
  listingId: string,
  buyerId?: string,
): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  const docId = inboxStateDocId(listingId, buyerId);
  await setDoc(
    doc(db, 'users', userId, 'inboxState', docId),
    {
      listingId,
      buyerId: buyerId ?? null,
      isArchived: false,
      archivedAt: null,
    },
    { merge: true },
  );
}
