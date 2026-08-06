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

describe('inboxServiceRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useBffInbox.mockReturnValue(false);
    fetchThreadsBff.mockResolvedValue({
      threads: [{ id: 't1', listingId: 'l1', inboxState: { listingId: 'l1' } }],
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
    const { subscribeInboxThreadsRouted } = await import(
      '@/features/messages/services/inboxServiceRouter'
    );

    const unsubscribe = subscribeInboxThreadsRouted('user-1', onData);

    await vi.runOnlyPendingTimersAsync();

    expect(fetchThreadsBff).toHaveBeenCalledWith({ limit: 30 });
    expect(onData).toHaveBeenCalledWith([{ id: 't1', listingId: 'l1' }]);
    expect(subscribeInboxThreads).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('shouldRouteInboxViaBff reflects flag', async () => {
    useBffInbox.mockReturnValue(true);
    const { shouldRouteInboxViaBff } = await import(
      '@/features/messages/services/inboxServiceRouter'
    );
    expect(shouldRouteInboxViaBff()).toBe(true);
  });
});
