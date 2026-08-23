import { describe, expect, it } from 'vitest';

import {
  THUMBNAIL_MAX_DIMENSION,
  createThumbnailBlob,
  thumbnailCacheKey,
} from '@/common/utils/thumbnailImage';

describe('thumbnailImage', () => {
  it('builds a stable thumb cache key', () => {
    expect(thumbnailCacheKey('/api/images/abc123')).toBe('thumb:/api/images/abc123');
  });

  it('returns the source blob when canvas APIs are unavailable', async () => {
    const source = new Blob(['raw'], { type: 'image/jpeg' });
    const result = await createThumbnailBlob(source);
    expect(result).toBe(source);
  });

  it('uses a browse-friendly max dimension', () => {
    expect(THUMBNAIL_MAX_DIMENSION).toBeGreaterThanOrEqual(256);
    expect(THUMBNAIL_MAX_DIMENSION).toBeLessThanOrEqual(512);
  });
});
