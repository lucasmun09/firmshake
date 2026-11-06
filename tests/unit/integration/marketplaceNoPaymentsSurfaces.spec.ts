/**
 * Cross-surface no-payments contracts that unit files cover in isolation:
 * description ranking → share → report → message image → mark-sold browse gate.
 * No MFA / live Firestore — pure module chain.
 */
import { describe, expect, it, vi } from 'vitest';

import { isListingAvailableForBrowse } from '@/features/listings/services/listingStatus';
import { buildListingReportPayload } from '@/features/listings/services/listingReports';
import {
  matchesListingSearchQuery,
  sortListingsBySearchRelevance,
} from '@/features/listings/utils/browseSearchRanking';
import {
  buildListingShareText,
  buildListingShareUrl,
  shareOrCopyListingLink,
} from '@/features/listings/utils/shareListing';
import { createOptimisticMessage } from '@/features/messages/services/messages';
import {
  MESSAGE_IMAGE_PREVIEW_TEXT,
  resolveMessagePreviewText,
  resolveMessageTextForSend,
} from '@/features/messages/utils/messageImage';

import {
  BUYER_ID,
  LISTING_ID,
  SELLER_ID,
  makeFullListing,
} from './marketplaceFixtures';

describe('integration — no-payments marketplace surfaces', () => {
  it('ranks description hits below title, then shares, reports, attaches photo, and gates sold', async () => {
    const titleHit = makeFullListing({
      id: 'title-hit',
      title: 'Trail bike frame',
      description: 'Unrelated body copy',
    });
    const descriptionHit = makeFullListing({
      id: 'desc-hit',
      title: 'Outdoor gear',
      description: 'Includes a trail bike accessory kit',
    });
    const ranked = sortListingsBySearchRelevance([descriptionHit, titleHit], 'trail bike');
    expect(ranked.map((listing) => listing.id)).toEqual(['title-hit', 'desc-hit']);
    expect(matchesListingSearchQuery(descriptionHit, 'trail bike')).toBe(true);

    const origin = 'https://firmshake-dev.web.app';
    const shareUrl = buildListingShareUrl(LISTING_ID, origin);
    expect(shareUrl).toBe(`${origin}/listing/${LISTING_ID}`);
    expect(buildListingShareText(titleHit.title, shareUrl)).toContain(shareUrl);

    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(
      shareOrCopyListingLink(
        { listingId: LISTING_ID, title: titleHit.title, origin },
        { canShare: false, writeText },
      ),
    ).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith(shareUrl);

    const report = buildListingReportPayload({
      listingId: LISTING_ID,
      sellerId: SELLER_ID,
      reporterId: BUYER_ID,
      reason: 'spam_scam',
      details: '  suspicious price  ',
    });
    expect(report).toMatchObject({
      listingId: LISTING_ID,
      sellerId: SELLER_ID,
      reporterId: BUYER_ID,
      reason: 'spam_scam',
      details: 'suspicious price',
      status: 'open',
    });
    expect(() =>
      buildListingReportPayload({
        listingId: LISTING_ID,
        sellerId: SELLER_ID,
        reporterId: SELLER_ID,
        reason: 'other',
      }),
    ).toThrow(/cannot report your own listing/i);

    const imageUrl = 'https://cdn.example/chat.jpg';
    const sendText = resolveMessageTextForSend('  ', imageUrl);
    expect(sendText).toBe(MESSAGE_IMAGE_PREVIEW_TEXT);
    const photo = createOptimisticMessage(
      LISTING_ID,
      BUYER_ID,
      'Buyer Bob',
      sendText,
      SELLER_ID,
      imageUrl,
    );
    expect(photo.imageUrl).toBe(imageUrl);
    expect(photo.text).toBe(MESSAGE_IMAGE_PREVIEW_TEXT);
    expect(resolveMessagePreviewText(photo.text, photo.imageUrl)).toBe(MESSAGE_IMAGE_PREVIEW_TEXT);

    const active = makeFullListing({ status: 'active' });
    const sold = makeFullListing({ status: 'sold' });
    expect(isListingAvailableForBrowse(active.status)).toBe(true);
    expect(isListingAvailableForBrowse(sold.status)).toBe(false);
  });
});
