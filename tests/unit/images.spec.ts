import { describe, expect, it } from 'vitest';

import {
  isProtectedApiImageUrl,
  prefetchListingPrimaryThumbnails,
} from '@/common/services/images';
import { thumbnailCacheKey } from '@/common/utils/thumbnailImage';

describe('images service', () => {
  it('detects protected API image URLs', () => {
    expect(isProtectedApiImageUrl('/api/images/0123456789abcdef0123456789abcdef')).toBe(true);
    expect(isProtectedApiImageUrl('https://example.com/photo.jpg')).toBe(false);
    expect(isProtectedApiImageUrl('/api/images/not-a-hash')).toBe(false);
  });

  it('dedupes primary thumbnail prefetch URLs', async () => {
    const requested: string[] = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (input) => {
      requested.push(String(input));
      return new Response(new Blob(['jpeg'], { type: 'image/jpeg' }), { status: 200 });
    };

    try {
      await prefetchListingPrimaryThumbnails([
        '/api/images/0123456789abcdef0123456789abcdef',
        '/api/images/0123456789abcdef0123456789abcdef',
        '',
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(requested).toHaveLength(1);
  });

  it('uses thumb-prefixed cache keys for browse thumbnails', () => {
    const url = '/api/images/0123456789abcdef0123456789abcdef';
    expect(thumbnailCacheKey(url)).toBe(`thumb:${url}`);
  });
});
