const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Short relative timestamps for list rows (saved at, last message, etc.).
 * Falls back to a medium date for older timestamps.
 */
export function formatRelativeTime(
  timestampMs: number,
  nowMs: number = Date.now(),
): string {
  if (!Number.isFinite(timestampMs)) {
    return '';
  }

  const delta = nowMs - timestampMs;
  if (delta < 0) {
    return 'just now';
  }
  if (delta < MINUTE_MS) {
    return 'just now';
  }
  if (delta < HOUR_MS) {
    const minutes = Math.floor(delta / MINUTE_MS);
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }
  if (delta < DAY_MS) {
    const hours = Math.floor(delta / HOUR_MS);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  if (delta < 7 * DAY_MS) {
    const days = Math.floor(delta / DAY_MS);
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(timestampMs));
}
