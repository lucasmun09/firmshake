import { describe, expect, it } from 'vitest';

import {
  DEBUG_LOG_SHARE_RECIPIENT,
  buildDebugLogShareMailtoUrl,
  getDebugLogExportFilename,
  getDebugLogShareEmailBody,
  getDebugLogShareEmailSubject,
} from '@/common/debug/debugLog';

const fixedDate = new Date('2025-06-20T14:32:05.000Z');

describe('debug log share helpers', () => {
  it('builds a UTC timestamped export filename', () => {
    expect(getDebugLogExportFilename(fixedDate)).toBe('firmshake-logs-2025-06-20T14-32-05-000Z.json');
  });

  it('builds the share email subject with UTC timestamp', () => {
    expect(getDebugLogShareEmailSubject(fixedDate)).toBe('Firm-Shake log file - 2025-06-20 14:32:05 GMT');
  });

  it('builds a body that tells the user to attach the downloaded file', () => {
    const filename = getDebugLogExportFilename(fixedDate);
    const body = getDebugLogShareEmailBody(filename);

    expect(body).toContain('Please attach the log file that was just downloaded');
    expect(body).toContain(filename);
    expect(body).toContain('Download logs');
  });

  it('builds a mailto URL for the developer inbox', () => {
    const url = buildDebugLogShareMailtoUrl(fixedDate);
    const query = url.split('?')[1] ?? '';

    expect(url.startsWith(`mailto:${DEBUG_LOG_SHARE_RECIPIENT}?`)).toBe(true);
    expect(query).not.toContain('+');

    const subject = decodeURIComponent(query.match(/subject=([^&]*)/)?.[1] ?? '');
    const body = decodeURIComponent(query.match(/body=(.*)/)?.[1] ?? '');

    expect(subject).toBe('Firm-Shake log file - 2025-06-20 14:32:05 GMT');
    expect(body).toContain('firmshake-logs-2025-06-20T14-32-05-000Z.json');
    expect(body).toContain('Please attach the log file that was just downloaded');
  });
});
