import type { ListingConversation, Message } from '@/types';

/** Oldest → newest for chat bubbles (composer sits below the latest message). */
export function sortMessagesChronological(messages: Message[]): Message[] {
  return [...messages].sort((left, right) => {
    const leftTime = left.createdAt?.getTime() ?? 0;
    const rightTime = right.createdAt?.getTime() ?? 0;
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return left.id.localeCompare(right.id);
  });
}

/** @deprecated Prefer sortMessagesChronological for chat UI. */
export function sortMessagesNewestFirst(messages: Message[]): Message[] {
  return [...sortMessagesChronological(messages)].reverse();
}

const sortMessages = sortMessagesChronological;

export function groupMessagesByBuyer(
  messages: Message[],
  sellerId: string,
): ListingConversation[] {
  const sorted = sortMessages(messages);
  const threads = new Map<string, { buyerName: string; messages: Message[] }>();
  let activeBuyerId: string | null = null;

  for (const message of sorted) {
    if (message.senderId !== sellerId) {
      activeBuyerId = message.senderId;
      const existing = threads.get(activeBuyerId);
      if (existing) {
        existing.messages.push(message);
        existing.buyerName = message.senderName;
      } else {
        threads.set(activeBuyerId, {
          buyerName: message.senderName,
          messages: [message],
        });
      }
      continue;
    }

    const targetBuyerId =
      message.recipientId && message.recipientId !== sellerId
        ? message.recipientId
        : activeBuyerId;

    if (!targetBuyerId) {
      continue;
    }

    const existing = threads.get(targetBuyerId);
    if (existing) {
      existing.messages.push(message);
    } else {
      threads.set(targetBuyerId, {
        buyerName: 'Buyer',
        messages: [message],
      });
    }
  }

  return [...threads.entries()]
    .map(([buyerId, data]) => {
      const lastMessage = data.messages[data.messages.length - 1];
      return {
        buyerId,
        buyerName: data.buyerName,
        messages: data.messages,
        lastMessage,
        lastMessageAt: lastMessage?.createdAt,
      };
    })
    .sort((left, right) => {
      const leftTime = left.lastMessageAt?.getTime() ?? 0;
      const rightTime = right.lastMessageAt?.getTime() ?? 0;
      return rightTime - leftTime;
    });
}

export function getConversationMessages(
  messages: Message[],
  sellerId: string,
  buyerId: string,
): Message[] {
  return (
    groupMessagesByBuyer(messages, sellerId).find(
      (conversation) => conversation.buyerId === buyerId,
    )?.messages ?? []
  );
}

export function filterMessagesForParticipant(
  messages: Message[],
  sellerId: string,
  userId: string,
): Message[] {
  if (userId === sellerId) {
    return messages;
  }

  return getConversationMessages(messages, sellerId, userId);
}
