import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Message } from '@/types';

const useBffMessages = vi.fn(() => false);
const sendMessageBff = vi.fn();
const sendMessageFirestore = vi.fn();

vi.mock('@/common/config/featureFlags', () => ({
  useBffMessages: () => useBffMessages(),
}));

vi.mock('@/features/messages/services/messageBff', () => ({
  sendListingMessage: (...args: unknown[]) => sendMessageBff(...args),
}));

vi.mock('@/features/messages/services/messageFirestoreWrites', () => ({
  sendListingMessageViaFirestore: (...args: unknown[]) => sendMessageFirestore(...args),
}));

const sampleMessage: Message = {
  id: 'msg-1',
  listingId: 'listing-1',
  senderId: 'buyer-1',
  senderName: 'Buyer Bob',
  text: 'Hello',
  recipientId: 'seller-1',
  createdAt: new Date(),
};

describe('messageServiceRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBffMessages.mockReturnValue(false);
    sendMessageBff.mockResolvedValue(sampleMessage);
    sendMessageFirestore.mockResolvedValue({ ...sampleMessage, id: 'fs-msg-1' });
  });

  it('routes send to Firestore when BFF flag is off', async () => {
    const { routeSendListingMessage } = await import(
      '@/features/messages/services/messageServiceRouter'
    );

    const result = await routeSendListingMessage('listing-1', 'Buyer Bob', 'Hello', {
      recipientId: 'seller-1',
    });

    expect(sendMessageFirestore).toHaveBeenCalledWith(
      'listing-1',
      'Buyer Bob',
      'Hello',
      { recipientId: 'seller-1' },
    );
    expect(sendMessageBff).not.toHaveBeenCalled();
    expect(result.id).toBe('fs-msg-1');
  });

  it('routes send to BFF when flag is on', async () => {
    useBffMessages.mockReturnValue(true);
    const { routeSendListingMessage } = await import(
      '@/features/messages/services/messageServiceRouter'
    );

    await routeSendListingMessage('listing-1', 'Buyer Bob', 'Hello');

    expect(sendMessageBff).toHaveBeenCalledWith('listing-1', 'Buyer Bob', {
      text: 'Hello',
      recipientId: undefined,
    });
    expect(sendMessageFirestore).not.toHaveBeenCalled();
  });

  it('shouldRouteMessagesViaBff reflects flag', async () => {
    useBffMessages.mockReturnValue(true);
    const { shouldRouteMessagesViaBff } = await import(
      '@/features/messages/services/messageServiceRouter'
    );
    expect(shouldRouteMessagesViaBff()).toBe(true);
  });
});
