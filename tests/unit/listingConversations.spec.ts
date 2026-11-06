import { describe, expect, it } from 'vitest';
import {
  sortMessagesChronological,
  sortMessagesNewestFirst,
} from '@/features/listings/utils/listingConversations';
import type { Message } from '@/types';

function msg(id: string, createdAtMs: number): Message {
  return {
    id,
    listingId: 'listing-1',
    senderId: 'u1',
    senderName: 'User',
    text: id,
    createdAt: new Date(createdAtMs),
  } as Message;
}

describe('listingConversations message ordering', () => {
  it('sorts chat bubbles oldest → newest', () => {
    const ordered = sortMessagesChronological([
      msg('c', 300),
      msg('a', 100),
      msg('b', 200),
    ]);
    expect(ordered.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('breaks timestamp ties by id ascending for chronological order', () => {
    const ordered = sortMessagesChronological([
      msg('b', 100),
      msg('a', 100),
    ]);
    expect(ordered.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('keeps newest-first as the reverse of chronological', () => {
    const input = [msg('c', 300), msg('a', 100), msg('b', 200)];
    expect(sortMessagesNewestFirst(input).map((m) => m.id)).toEqual(['c', 'b', 'a']);
  });
});
