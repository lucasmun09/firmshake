import { describe, expect, it } from 'vitest';

import { buildListingReportPayload } from '@/features/listings/services/listingReports';
import {
  isListingReportReason,
  normalizeListingReportReason,
} from '@/features/listings/utils/listingReportReasons';

describe('listingReportReasons', () => {
  it('validates and normalizes reasons', () => {
    expect(isListingReportReason('spam_scam')).toBe(true);
    expect(isListingReportReason('nope')).toBe(false);
    expect(normalizeListingReportReason('Inappropriate')).toBe('inappropriate');
    expect(normalizeListingReportReason('???')).toBe('other');
  });
});

describe('buildListingReportPayload', () => {
  it('shapes a valid report and rejects self-reports', () => {
    expect(
      buildListingReportPayload({
        listingId: 'listing-1',
        sellerId: 'seller-1',
        reporterId: 'buyer-1',
        reason: 'spam_scam',
        details: '  looks fake  ',
      }),
    ).toEqual({
      listingId: 'listing-1',
      sellerId: 'seller-1',
      reporterId: 'buyer-1',
      reason: 'spam_scam',
      details: 'looks fake',
      status: 'open',
    });

    expect(() =>
      buildListingReportPayload({
        listingId: 'listing-1',
        sellerId: 'same',
        reporterId: 'same',
        reason: 'other',
      }),
    ).toThrow(/cannot report your own listing/i);

    expect(() =>
      buildListingReportPayload({
        listingId: '',
        sellerId: 'seller-1',
        reporterId: 'buyer-1',
        reason: 'other',
      }),
    ).toThrow(/Missing report fields/i);
  });
});
