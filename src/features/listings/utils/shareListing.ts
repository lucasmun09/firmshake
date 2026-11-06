/** Build and share / copy a canonical listing deep link. */

export function buildListingShareUrl(
  listingId: string,
  origin: string = typeof window !== 'undefined' ? window.location.origin : '',
): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/listing/${encodeURIComponent(listingId)}`;
}

export function buildListingShareText(title: string, url: string): string {
  const trimmed = title.trim() || 'FirmShake listing';
  return `${trimmed}\n${url}`;
}

export type ShareListingOutcome = 'shared' | 'copied' | 'unavailable';

export type ShareListingDeps = {
  share?: (data: ShareData) => Promise<void>;
  canShare?: boolean;
  writeText?: (text: string) => Promise<void>;
};

/**
 * Prefer Web Share when available; otherwise copy the URL to the clipboard.
 * Returns `unavailable` when neither path can run (e.g. missing clipboard).
 */
export async function shareOrCopyListingLink(
  input: { listingId: string; title: string; origin?: string },
  deps: ShareListingDeps = {},
): Promise<ShareListingOutcome> {
  const url = buildListingShareUrl(input.listingId, input.origin);
  const text = buildListingShareText(input.title, url);

  const shareFn =
    deps.share
    ?? (typeof navigator !== 'undefined' && typeof navigator.share === 'function'
      ? navigator.share.bind(navigator)
      : undefined);
  const canShare = deps.canShare ?? Boolean(shareFn);
  const writeText =
    deps.writeText
    ?? (typeof navigator !== 'undefined' && navigator.clipboard?.writeText
      ? navigator.clipboard.writeText.bind(navigator.clipboard)
      : undefined);

  if (canShare && shareFn) {
    try {
      await shareFn({ title: input.title.trim() || 'FirmShake listing', text, url });
      return 'shared';
    } catch (error) {
      // User cancel should not fall through to clipboard spam.
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'unavailable';
      }
    }
  }

  if (!writeText) {
    return 'unavailable';
  }

  await writeText(url);
  return 'copied';
}
