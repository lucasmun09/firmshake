import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

import { debugLog, serializeError } from '@/common/debug/debugLog';
import { db } from '@/common/services/firebase';
import {
  LISTING_REPORT_REASONS,
  normalizeListingReportReason,
  type ListingReportReason,
} from '@/features/listings/utils/listingReportReasons';

export { LISTING_REPORT_REASONS, normalizeListingReportReason, type ListingReportReason };

export type SubmitListingReportInput = {
  listingId: string;
  sellerId: string;
  reporterId: string;
  reason: string;
  details?: string;
};

export type ListingReportRecord = {
  listingId: string;
  sellerId: string;
  reporterId: string;
  reason: ListingReportReason;
  details: string;
  status: 'open';
};

/** Validate + shape a report payload before persistence. */
export function buildListingReportPayload(
  input: SubmitListingReportInput,
): ListingReportRecord {
  const listingId = input.listingId.trim();
  const sellerId = input.sellerId.trim();
  const reporterId = input.reporterId.trim();

  if (!listingId || !sellerId || !reporterId) {
    throw new Error('Missing report fields');
  }

  if (sellerId === reporterId) {
    throw new Error('You cannot report your own listing');
  }

  return {
    listingId,
    sellerId,
    reporterId,
    reason: normalizeListingReportReason(input.reason),
    details: (input.details ?? '').trim().slice(0, 500),
    status: 'open',
  };
}

/** Persist a buyer abuse report for moderator review. */
export async function submitListingReport(
  input: SubmitListingReportInput,
): Promise<ListingReportRecord> {
  if (!db) {
    throw new Error('Firestore is not configured');
  }

  const payload = buildListingReportPayload(input);
  debugLog.info('listing-report', 'submit.start', {
    listingId: payload.listingId,
    reason: payload.reason,
  });

  try {
    await addDoc(collection(db, 'listingReports'), {
      ...payload,
      createdAt: serverTimestamp(),
    });
    debugLog.info('listing-report', 'submit.done', {
      listingId: payload.listingId,
      reason: payload.reason,
    });
    return payload;
  } catch (error) {
    debugLog.error('listing-report', 'submit.failed', {
      listingId: payload.listingId,
      error: serializeError(error),
    });
    throw error instanceof Error ? error : new Error('Could not submit report');
  }
}
