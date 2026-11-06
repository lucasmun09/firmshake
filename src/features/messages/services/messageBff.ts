import { sendListingMessageViaBff as sendListingMessageApi } from '@/common/services/api';
import type { Message } from '@/types';

/** Request body for `POST /api/v1/listings/{listingId}/messages`. */
export interface SendListingMessageInput {
  text: string;
  recipientId?: string;
  imageUrl?: string;
}

/** Send a listing message via firmshake-api (thread sync + notification + push server-side). */
export async function sendListingMessage(
  listingId: string,
  senderName: string,
  input: SendListingMessageInput,
): Promise<Message> {
  return sendListingMessageApi(listingId, senderName, input);
}
