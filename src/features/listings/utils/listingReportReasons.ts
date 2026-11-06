/** Allowed buyer report reasons for listing abuse flags. */

export const LISTING_REPORT_REASONS = [
  'spam_scam',
  'inappropriate',
  'prohibited',
  'other',
] as const;

export type ListingReportReason = (typeof LISTING_REPORT_REASONS)[number];

export function isListingReportReason(value: string): value is ListingReportReason {
  return (LISTING_REPORT_REASONS as readonly string[]).includes(value);
}

export function normalizeListingReportReason(value: string): ListingReportReason {
  const trimmed = value.trim().toLowerCase();
  if (isListingReportReason(trimmed)) {
    return trimmed;
  }
  return 'other';
}
