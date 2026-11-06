import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useBffInbox = vi.fn(() => false);
const markReadBff = vi.fn();
const archiveBff = vi.fn();
const unarchiveBff = vi.fn();
const fetchThreadsBff = vi.fn();
const markReadFirestore = vi.fn();
const archiveFirestore = vi.fn();
const unarchiveFirestore = vi.fn();
const subscribeInboxThreads = vi.fn(() => () => undefined);

vi.mock('@/common/config/featureFlags', () => ({
  useBffInbox: () => useBffInbox(),
}));

vi.mock('@/features/messages/services/inboxBff', () => ({
  markConversationRead: (...args: unknown[]) => markReadBff(...args),
  archiveConversation: (...args: unknown[]) => archiveBff(...args),
  unarchiveConversation: (...args: unknown[]) => unarchiveBff(...args),
  fetchInboxThreads: (...args: unknown[]) => fetchThreadsBff(...args),
}));

vi.mock('@/features/messages/services/inboxFirestoreWrites', () => ({
  markConversationViewed: (...args: unknown[]) => markReadFirestore(...args),
  archiveConversation: (...args: unknown[]) => archiveFirestore(...args),
  unarchiveConversation: (...args: unknown[]) => unarchiveFirestore(...args),
}));

vi.mock('@/features/messages/services/threads', () => ({
  subscribeInboxThreads: (...args: unknown[]) => subscribeInboxThreads(...args),
}));

vi.mock('@/common/debug/debugLog', () => ({
  debugLog: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  serializeError: (error: unknown) => ({ message: String(error) }),
}));

describe('inboxServiceRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useBffInbox.mockReturnValue(false);
    fetchThreadsBff.mockResolvedValue({
      threads: [
        {
          id: 't1',
          listingId: 'l1',
          listingTitle: 'Bike',
          listingImageUrl: '',
          sellerId: 's1',
          sellerName: 'Sam',
          lastMessageText: 'hi',
          lastMessageSenderId: 'b1',
          lastMessageSenderName: 'Bob',
          inboxState: { listingId: 'l1', hasViewed: false, isArchived: false },
        },
      ],
      hasMore: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('routes mark read to Firestore when BFF flag is off', async () => {
    const { routeMarkConversationViewed } = await import(
      '@/features/messages/services/inboxServiceRouter'
    );

    await routeMarkConversationViewed('user-1', 'listing-1', 'buyer-1');

    expect(markReadFirestore).toHaveBeenCalledWith('user-1', 'listing-1', 'buyer-1');
    expect(markReadBff).not.toHaveBeenCalled();
  });

  it('routes archive to BFF when flag is on', async () => {
    useBffInbox.mockReturnValue(true);
    const { routeArchiveConversation } = await import(
      '@/features/messages/services/inboxServiceRouter'
    );

    await routeArchiveConversation('user-1', 'listing-1', 'buyer-1');

    expect(archiveBff).toHaveBeenCalledWith('listing-1', 'buyer-1');
    expect(archiveFirestore).not.toHaveBeenCalled();
  });

  it('routes unarchive to BFF when flag is on', async () => {
    useBffInbox.mockReturnValue(true);
    const { routeUnarchiveConversation } = await import(
      '@/features/messages/services/inboxServiceRouter'
    );

    await routeUnarchiveConversation('user-1', 'listing-1');

    expect(unarchiveBff).toHaveBeenCalledWith('listing-1', undefined);
    expect(unarchiveFirestore).not.toHaveBeenCalled();
  });

  it('subscribeInboxThreadsRouted uses Firestore subscription when flag is off', async () => {
    const onData = vi.fn();
    const { subscribeInboxThreadsRouted } = await import(
      '@/features/messages/services/inboxServiceRouter'
    );

    subscribeInboxThreadsRouted('user-1', onData);

    expect(subscribeInboxThreads).toHaveBeenCalledWith('user-1', onData, undefined);
    expect(fetchThreadsBff).not.toHaveBeenCalled();
  });

  it('subscribeInboxThreadsRouted polls BFF when flag is on', async () => {
    useBffInbox.mockReturnValue(true);
    const onData = vi.fn();
    const onInboxStates = vi.fn();
    const { subscribeInboxThreadsRouted } = await import(
      '@/features/messages/services/inboxServiceRouter'
    );

    const unsubscribe = subscribeInboxThreadsRouted('user-1', {
      onData,
      onInboxStates,
    });

    await vi.runOnlyPendingTimersAsync();

    expect(fetchThreadsBff).toHaveBeenCalledWith({ limit: 30, cursor: undefined });
    expect(onData).toHaveBeenCalledWith([
      expect.objectContaining({ id: 't1', listingId: 'l1' }),
    ]);
    expect(onData.mock.calls[0][0][0]).not.toHaveProperty('inboxState');
    expect(onInboxStates).toHaveBeenCalledWith(
      expect.any(Map),
    );
    expect(onInboxStates.mock.calls[0][0].get('t1')).toEqual(
      expect.objectContaining({ listingId: 'l1', isArchived: false }),
    );
    expect(subscribeInboxThreads).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('subscribeInboxThreadsRouted walks multiple BFF pages', async () => {
    useBffInbox.mockReturnValue(true);
    fetchThreadsBff
      .mockResolvedValueOnce({
        threads: [
          {
            id: 't1',
            listingId: 'l1',
            listingTitle: 'A',
            listingImageUrl: '',
            sellerId: 's1',
            sellerName: 'Sam',
            lastMessageText: '1',
            lastMessageSenderId: 'b1',
            lastMessageSenderName: 'Bob',
          },
        ],
        nextCursor: 't1',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        threads: [
          {
            id: 't2',
            listingId: 'l2',
            listingTitle: 'B',
            listingImageUrl: '',
            sellerId: 's1',
            sellerName: 'Sam',
            lastMessageText: '2',
            lastMessageSenderId: 'b1',
            lastMessageSenderName: 'Bob',
          },
        ],
        hasMore: false,
      });

    const onData = vi.fn();
    const { subscribeInboxThreadsRouted } = await import(
      '@/features/messages/services/inboxServiceRouter'
    );

    const unsubscribe = subscribeInboxThreadsRouted('user-1', onData);
    // Flush the initial poll only — do not advance the 30s interval.
    await Promise.resolve();
    await Promise.resolve();
    await vi.waitFor(() => {
      expect(onData).toHaveBeenCalled();
    });
    unsubscribe();

    expect(fetchThreadsBff).toHaveBeenCalledTimes(2);
    expect(onData.mock.calls[0][0].map((t: { id: string }) => t.id)).toEqual(['t1', 't2']);
  });

  it('shouldRouteInboxViaBff reflects flag', async () => {
    useBffInbox.mockReturnValue(true);
    const { shouldRouteInboxViaBff } = await import(
      '@/features/messages/services/inboxServiceRouter'
    );
    expect(shouldRouteInboxViaBff()).toBe(true);
  });
});
