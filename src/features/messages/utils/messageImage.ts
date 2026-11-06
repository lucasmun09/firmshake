/** Shared preview copy for image-only chat messages (thread list + bubbles). */

export const MESSAGE_IMAGE_PREVIEW_TEXT = 'Photo';
export const MAX_MESSAGE_IMAGE_URL_LENGTH = 2048;

export function normalizeMessageImageUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_MESSAGE_IMAGE_URL_LENGTH) {
    return undefined;
  }
  return trimmed;
}

/** Body text for send/notify when the user attaches a photo with optional caption. */
export function resolveMessageTextForSend(text: string, imageUrl?: string): string {
  const trimmed = text.trim();
  if (trimmed) {
    return trimmed;
  }
  if (imageUrl) {
    return MESSAGE_IMAGE_PREVIEW_TEXT;
  }
  throw new Error('Message cannot be empty');
}

/** Inbox / conversation preview — prefer caption, else Photo when an image is present. */
export function resolveMessagePreviewText(text: string, imageUrl?: string): string {
  const trimmed = text.trim();
  if (trimmed && !(imageUrl && trimmed === MESSAGE_IMAGE_PREVIEW_TEXT)) {
    return trimmed;
  }
  if (imageUrl) {
    return MESSAGE_IMAGE_PREVIEW_TEXT;
  }
  return trimmed;
}
