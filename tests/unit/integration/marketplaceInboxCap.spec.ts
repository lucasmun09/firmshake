/**
 * Inbox cap + BFF accumulate + enrich + archive + browse block-list contracts.
 * Cross-module integration for the no-payments messaging surface (no live Firestore).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyBrowseBlockListFilter } from '@/features/listings/utils/browseBlockFilter';
import {
  inboxStateDocId,
  isThreadUnread,
  partitionByArchive,
} from '@/features/messages/services/inboxState';
import {
  accumulateInboxThreadPages,
  BFF_INBOX_MAX_PAGES,
  BFF_INBOX_PAGE_SIZE,
  inboxStatesFromBffThreads,
  stripInboxStateFromThreads,
} from '@/features/messages/services/inboxBffPages';
import {
  clearThreadEnrichCache,
  setThreadEnrichListing,
} from '@/features/messages/services/threadEnrichCache';
import {
  FIRESTORE_INBOX_THREAD_CAP,
  THREADS_PAGE_SIZE,
  capSortedInboxThreads,
  enrichThreads,
  sortThreads,
} from '@/features/messages/services/threadModel';
import type { InboxState, MessageThread } from '@/types';

import {
  BUYER_ID,
  LISTING_ID,
  SELLER_ID,
  makeFullListing,
  makeThread,
} from './marketplaceFixtures';

const getListingsByIds = vi.fn();

vi.mock('@/features/listings/services/listings', () => ({
  getListingsByIds: (...args: unknown[]) => getListingsByIds(...args),
}));

function makeDatedThread(
  index: number,
  overrides: Partial<MessageThread> = {},
): MessageThread {
  const listingId = `listing-${index}`;
  return makeThread({
    id: listingId,
    listingId,
    listingTitle: `Listing ${index}`,
    lastMessageAt: new Date(1_700_000_000_000 + index * 1_000),
    lastMessageText: `msg-${index}`,
    ...overrides,
  });
}

describe('integration — inbox cap / BFF accumulate / enrich / block-list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearThreadEnrichCache();
  });

  it('keeps Firestore inbox cap at BFF accumulate parity (10 × page size)', () => {
    expect(THREADS_PAGE_SIZE).toBe(BFF_INBOX_PAGE_SIZE);
    expect(FIRESTORE_INBOX_THREAD_CAP).toBe(BFF_INBOX_PAGE_SIZE * BFF_INBOX_MAX_PAGES);
    expect(FIRESTORE_INBOX_THREAD_CAP).toBe(300);
  });

  it('caps a large Firestore-shaped inbox to newest threads only', () => {
    const many = Array.from({ length: FIRESTORE_INBOX_THREAD_CAP + 40 }, (_, index) =>
      makeDatedThread(index),
    );

    const capped = capSortedInboxThreads(many);
    expect(capped).toHaveLength(FIRESTORE_INBOX_THREAD_CAP);
    expect(capped[0]?.id).toBe(`listing-${FIRESTORE_INBOX_THREAD_CAP + 39}`);
    expect(capped[capped.length - 1]?.id).toBe('listing-40');
  });

  it('accumulates BFF cursor pages up to the same 300-thread ceiling', async () => {
    const pageSize = BFF_INBOX_PAGE_SIZE;
    const maxPages = BFF_INBOX_MAX_PAGES;
    let pageIndex = 0;

    const fetchPage = vi.fn(async () => {
      const start = pageIndex * pageSize;
      const threads = Array.from({ length: pageSize }, (_, offset) =>
        makeDatedThread(start + offset, {
          inboxState: {
            listingId: `listing-${start + offset}`,
            hasViewed: offset % 2 === 0,
            isArchived: offset === 0 && pageIndex === maxPages - 1,
          },
        }),
      );
      pageIndex += 1;
      const hasMore = pageIndex < maxPages + 2;
      return {
        threads,
        hasMore,
        nextCursor: hasMore ? `cursor-${pageIndex}` : undefined,
      };
    });

    const accumulated = await accumulateInboxThreadPages(fetchPage);
    expect(accumulated.pagesFetched).toBe(maxPages);
    expect(accumulated.truncated).toBe(true);
    expect(accumulated.threads).toHaveLength(FIRESTORE_INBOX_THREAD_CAP);

    const stripped = stripInboxStateFromThreads(accumulated.threads);
    expect(stripped[0]).not.toHaveProperty('inboxState');

    const states = inboxStatesFromBffThreads(accumulated.threads);
    expect(states.size).toBe(FIRESTORE_INBOX_THREAD_CAP);
    const lastPageFirst = accumulated.threads[FIRESTORE_INBOX_THREAD_CAP - pageSize];
    expect(states.get(lastPageFirst!.id)?.isArchived).toBe(true);
  });

  it('partitions accumulated BFF threads by archive and suppresses New on archived', () => {
    const active = makeThread({
      id: LISTING_ID,
      lastMessageSenderId: BUYER_ID,
    });
    const archivedId = sellerThreadId(LISTING_ID, 'buyer-2');
    const archived = makeThread({
      id: archivedId,
      buyerId: 'buyer-2',
      lastMessageSenderId: 'buyer-2',
    });
    const withState = [
      { ...active, inboxState: { listingId: LISTING_ID, hasViewed: false, isArchived: false } },
      {
        ...archived,
        inboxState: {
          listingId: LISTING_ID,
          buyerId: 'buyer-2',
          hasViewed: true,
          isArchived: true,
        } satisfies InboxState,
      },
    ];

    const states = inboxStatesFromBffThreads(withState);
    const threads = stripInboxStateFromThreads(withState);
    const partitioned = partitionByArchive(threads, states);

    expect(partitioned.active).toEqual([active]);
    expect(partitioned.archived).toEqual([archived]);
    expect(isThreadUnread(archived, states, SELLER_ID)).toBe(false);
    expect(isThreadUnread(active, states, SELLER_ID)).toBe(true);
  });

  it('enriches capped inbox rows from cache before hitting listing batch reads', async () => {
    setThreadEnrichListing({
      id: LISTING_ID,
      title: 'Cached Bike Title',
      imageUrl: 'https://example.com/cached.jpg',
      sellerId: SELLER_ID,
      sellerName: 'Sam Seller',
      status: 'active',
    });

    const coldListingId = 'listing-cold';
    getListingsByIds.mockResolvedValue(
      new Map([
        [
          coldListingId,
          makeFullListing({
            id: coldListingId,
            title: 'Fetched Cold Listing',
            imageUrl: 'https://example.com/cold.jpg',
          }),
        ],
      ]),
    );

    const threads = sortThreads([
      makeThread({ listingTitle: 'stale', listingImageUrl: '' }),
      makeThread({
        id: coldListingId,
        listingId: coldListingId,
        listingTitle: 'stale-cold',
        listingImageUrl: '',
        lastMessageAt: new Date('2026-01-16T09:00:00Z'),
      }),
    ]);

    const enriched = await enrichThreads(threads);
    expect(enriched[0]?.listingTitle).toBe('Cached Bike Title');
    expect(enriched[0]?.listingImageUrl).toBe('https://example.com/cached.jpg');
    expect(enriched[1]?.listingTitle).toBe('Fetched Cold Listing');
    expect(getListingsByIds).toHaveBeenCalledTimes(1);
    expect(getListingsByIds.mock.calls[0]?.[0]).toEqual([coldListingId]);
  });

  it('filters blocked sellers from a browse page after inbox block side-effect paint', () => {
    const ok = makeFullListing({ id: 'ok', sellerId: 'seller-ok' });
    const blocked = makeFullListing({ id: 'blocked', sellerId: 'seller-blocked' });

    const filtered = applyBrowseBlockListFilter(
      { listings: [ok, blocked] },
      new Set(['seller-blocked']),
    );

    expect(filtered.listings.map((row) => row.id)).toEqual(['ok']);
    expect(filtered.pinGroups).toBeUndefined();
  });
});

function sellerThreadId(listingId: string, buyerId: string): string {
  return inboxStateDocId(listingId, buyerId);
}
