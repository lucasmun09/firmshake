/**
 * Routes listing message sends to Firestore or firmshake-api based on feature flags.
 */
import { useBffMessages } from '@/common/config/featureFlags';
import type { Message } from '@/types';

import * as messageBff from './messageBff';
import * as messageFirestoreWrites from './messageFirestoreWrites';

export function shouldRouteMessagesViaBff(): boolean {
  return useBffMessages();
}

export async function routeSendListingMessage(
  listingId: string,
  senderName: string,
  text: string,
  options?: { recipientId?: string; imageUrl?: string },
): Promise<Message> {
  if (useBffMessages()) {
    return messageBff.sendListingMessage(listingId, senderName, {
      text,
      recipientId: options?.recipientId,
      imageUrl: options?.imageUrl,
    });
  }
  return messageFirestoreWrites.sendListingMessageViaFirestore(
    listingId,
    senderName,
    text,
    options,
  );
}
