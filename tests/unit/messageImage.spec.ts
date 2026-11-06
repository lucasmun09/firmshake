import { describe, expect, it } from 'vitest';

import {
  MESSAGE_IMAGE_PREVIEW_TEXT,
  normalizeMessageImageUrl,
  resolveMessagePreviewText,
  resolveMessageTextForSend,
} from '@/features/messages/utils/messageImage';

describe('messageImage', () => {
  it('normalizes image URLs and rejects empty/oversized values', () => {
    expect(normalizeMessageImageUrl('  https://cdn/x.jpg  ')).toBe('https://cdn/x.jpg');
    expect(normalizeMessageImageUrl('')).toBeUndefined();
    expect(normalizeMessageImageUrl('x'.repeat(2049))).toBeUndefined();
  });

  it('resolves send text with Photo fallback for image-only messages', () => {
    expect(resolveMessageTextForSend('hi', undefined)).toBe('hi');
    expect(resolveMessageTextForSend('  ', 'https://cdn/x.jpg')).toBe(MESSAGE_IMAGE_PREVIEW_TEXT);
    expect(() => resolveMessageTextForSend('  ')).toThrow(/cannot be empty/i);
  });

  it('resolves inbox preview text', () => {
    expect(resolveMessagePreviewText('Hello', undefined)).toBe('Hello');
    expect(resolveMessagePreviewText(MESSAGE_IMAGE_PREVIEW_TEXT, 'https://cdn/x.jpg')).toBe(
      MESSAGE_IMAGE_PREVIEW_TEXT,
    );
    expect(resolveMessagePreviewText('Caption', 'https://cdn/x.jpg')).toBe('Caption');
  });
});
