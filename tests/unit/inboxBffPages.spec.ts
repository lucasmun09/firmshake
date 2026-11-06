import { describe, expect, it, vi } from 'vitest';

import {
  accumulateInboxThreadPages,
  BFF_INBOX_MAX_PAGES,
  BFF_INBOX_PAGE_SIZE,
  inboxStatesFromBffThreads,
  stripInboxStateFromThreads,
} from '@/features/messages/services/inboxBffPages';
import type { InboxThreadsPage } from '@/features/messages/services/inboxBff';
import type { InboxState, MessageThread } from '@/types';

function thread(
  id: string,
  inboxState?: InboxState,
): MessageThread & { inboxState?: InboxState } {
  return {
    id,
    listingId: id.split('_')[0] ?? id,
    buyerId: id.includes('_') ? id.split('_')[1] : undefined,
    listingTitle: `Listing ${id}`,
    listingImageUrl: '',
    sellerId: 'seller-1',
    sellerName: 'Seller',
    lastMessageText: 'hi',
    lastMessageSenderId: 'buyer-1',
    lastMessageSenderName: 'Buyer',
    inboxState,
  };
}

function page(
  threads: InboxThreadsPage['threads'],
  opts?: { nextCursor?: string; hasMore?: boolean },
): InboxThreadsPage {
  return {
    threads,
    nextCursor: opts?.nextCursor,
    hasMore: opts?.hasMore ?? Boolean(opts?.nextCursor),
  };
}

describe('accumulateInboxThreadPages', () => {
  it('returns a single page when hasMore is false', async () => {
    const fetchPage = vi.fn().mockResolvedValue(page([thread('a')], { hasMore: false }));

    const result = await accumulateInboxThreadPages(fetchPage);

    expect(result.threads.map((t) => t.id)).toEqual(['a']);
    expect(result.pagesFetched).toBe(1);
    expect(result.truncated).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith({ limit: BFF_INBOX_PAGE_SIZE, cursor: undefined });
  });

  it('walks cursor pages until exhausted', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page([thread('a'), thread('b')], { nextCursor: 'b', hasMore: true }))
      .mockResolvedValueOnce(page([thread('c')], { hasMore: false }));

    const result = await accumulateInboxThreadPages(fetchPage, { pageSize: 2 });

    expect(result.threads.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(result.pagesFetched).toBe(2);
    expect(result.truncated).toBe(false);
    expect(fetchPage).toHaveBeenNthCalledWith(1, { limit: 2, cursor: undefined });
    expect(fetchPage).toHaveBeenNthCalledWith(2, { limit: 2, cursor: 'b' });
  });

  it('stops at maxPages and marks truncated', async () => {
    const fetchPage = vi.fn().mockImplementation(async ({ cursor }: { cursor?: string }) => {
      const id = cursor ? `n-${cursor}` : 'n-0';
      return page([thread(id)], { nextCursor: id, hasMore: true });
    });

    const result = await accumulateInboxThreadPages(fetchPage, { maxPages: 3, pageSize: 1 });

    expect(result.pagesFetched).toBe(3);
    expect(result.truncated).toBe(true);
    expect(result.threads).toHaveLength(3);
    expect(result.nextCursor).toBeTruthy();
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('defaults maxPages to BFF_INBOX_MAX_PAGES', async () => {
    const fetchPage = vi.fn().mockResolvedValue(
      page([thread('x')], { nextCursor: 'x', hasMore: true }),
    );

    const result = await accumulateInboxThreadPages(fetchPage);

    expect(result.pagesFetched).toBe(BFF_INBOX_MAX_PAGES);
    expect(result.truncated).toBe(true);
  });
});

describe('stripInboxStateFromThreads / inboxStatesFromBffThreads', () => {
  it('strips inboxState for thread list consumers', () => {
    const withState = thread('listing-1_buyer-1', {
      listingId: 'listing-1',
      buyerId: 'buyer-1',
      hasViewed: true,
      isArchived: false,
    });

    const stripped = stripInboxStateFromThreads([withState]);
    expect(stripped[0]).not.toHaveProperty('inboxState');
    expect(stripped[0].id).toBe('listing-1_buyer-1');
  });

  it('maps inboxState by thread id', () => {
    const archived = thread('listing-1', {
      listingId: 'listing-1',
      hasViewed: true,
      isArchived: true,
    });
    const states = inboxStatesFromBffThreads([archived, thread('listing-2')]);

    expect(states.size).toBe(1);
    expect(states.get('listing-1')?.isArchived).toBe(true);
  });
});
