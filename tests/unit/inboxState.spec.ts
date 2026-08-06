import { describe, expect, it } from 'vitest';

import { isThreadUnread } from '@/features/messages/services/inboxState';
import type { InboxState } from '@/types';

const currentUserId = 'user-a';
const otherUserId = 'user-b';

function makeState(overrides: Partial<InboxState> = {}): InboxState {
  return {
    listingId: 'listing-1',
    hasViewed: true,
    ...overrides,
  };
}

describe('isThreadUnread', () => {
  it('returns false when the latest message was sent by the current user', () => {
    const states = new Map<string, InboxState>();
    const thread = {
      listingId: 'listing-1',
      lastMessageAt: new Date('2026-06-20T12:00:00Z'),
      lastMessageSenderId: currentUserId,
    };

    expect(isThreadUnread(thread, states, currentUserId)).toBe(false);
  });

  it('returns true when another user sent a message after lastReadAt', () => {
    const states = new Map<string, InboxState>([
      [
        'listing-1',
        makeState({
          lastReadAt: new Date('2026-06-20T11:00:00Z'),
        }),
      ],
    ]);
    const thread = {
      listingId: 'listing-1',
      lastMessageAt: new Date('2026-06-20T12:00:00Z'),
      lastMessageSenderId: otherUserId,
    };

    expect(isThreadUnread(thread, states, currentUserId)).toBe(true);
  });

  it('returns false for archived threads even with unread messages from others', () => {
    const states = new Map<string, InboxState>([
      [
        'listing-1',
        makeState({
          isArchived: true,
          lastReadAt: new Date('2026-06-20T11:00:00Z'),
        }),
      ],
    ]);
    const thread = {
      listingId: 'listing-1',
      lastMessageAt: new Date('2026-06-20T12:00:00Z'),
      lastMessageSenderId: otherUserId,
    };

    expect(isThreadUnread(thread, states, currentUserId)).toBe(false);
  });

  it('returns false when never read but the current user sent the only message', () => {
    const states = new Map<string, InboxState>();
    const thread = {
      listingId: 'listing-1',
      lastMessageAt: new Date('2026-06-20T12:00:00Z'),
      lastMessageSenderId: currentUserId,
    };

    expect(isThreadUnread(thread, states, currentUserId)).toBe(false);
  });

  it('returns true when never read and another user sent a message', () => {
    const states = new Map<string, InboxState>();
    const thread = {
      listingId: 'listing-1',
      lastMessageAt: new Date('2026-06-20T12:00:00Z'),
      lastMessageSenderId: otherUserId,
    };

    expect(isThreadUnread(thread, states, currentUserId)).toBe(true);
  });
});
