import { describe, expect, it, vi } from 'vitest';

import {
  buildListingShareText,
  buildListingShareUrl,
  shareOrCopyListingLink,
} from '@/features/listings/utils/shareListing';

describe('shareListing', () => {
  it('builds a canonical listing URL from origin + id', () => {
    expect(buildListingShareUrl('abc-123', 'https://firmshake-dev.web.app')).toBe(
      'https://firmshake-dev.web.app/listing/abc-123',
    );
    expect(buildListingShareUrl('a/b', 'https://firm-shake.com/')).toBe(
      'https://firm-shake.com/listing/a%2Fb',
    );
  });

  it('builds share text with title and url', () => {
    expect(buildListingShareText('Vintage lamp', 'https://x/listing/1')).toBe(
      'Vintage lamp\nhttps://x/listing/1',
    );
    expect(buildListingShareText('   ', 'https://x/listing/1')).toBe(
      'FirmShake listing\nhttps://x/listing/1',
    );
  });

  it('uses Web Share when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();

    await expect(
      shareOrCopyListingLink(
        { listingId: '1', title: 'Chair', origin: 'https://app.test' },
        { share, canShare: true, writeText },
      ),
    ).resolves.toBe('shared');

    expect(share).toHaveBeenCalledWith({
      title: 'Chair',
      text: 'Chair\nhttps://app.test/listing/1',
      url: 'https://app.test/listing/1',
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to clipboard copy when share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(
      shareOrCopyListingLink(
        { listingId: '9', title: 'Desk', origin: 'https://app.test' },
        { canShare: false, writeText },
      ),
    ).resolves.toBe('copied');

    expect(writeText).toHaveBeenCalledWith('https://app.test/listing/9');
  });

  it('treats AbortError from share as unavailable without clipboard fallback', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('dismissed', 'AbortError'));
    const writeText = vi.fn();

    await expect(
      shareOrCopyListingLink(
        { listingId: '1', title: 'Chair', origin: 'https://app.test' },
        { share, canShare: true, writeText },
      ),
    ).resolves.toBe('unavailable');

    expect(writeText).not.toHaveBeenCalled();
  });

  it('returns unavailable when neither share nor clipboard works', async () => {
    await expect(
      shareOrCopyListingLink(
        { listingId: '1', title: 'Chair', origin: 'https://app.test' },
        { canShare: false },
      ),
    ).resolves.toBe('unavailable');
  });
});
