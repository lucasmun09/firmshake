import { describe, expect, it } from 'vitest';
import {
  CONTROLPANEL_HOSTING_ORIGIN,
  DEVO_API_HOST_MARKER,
  DEVO_FIREBASE_PROJECT_ID,
  PROD_FIREBASE_PROJECT_ID,
  PROD_PUBLIC_HOSTNAMES,
  isProdPublicHostnameValue,
  normalizeHostname,
} from '@/common/config/stackHosts';

describe('stackHosts', () => {
  it('keeps deovo and prod project ids distinct', () => {
    expect(DEVO_FIREBASE_PROJECT_ID).toBe('firmshake-dev');
    expect(PROD_FIREBASE_PROJECT_ID).toBe('firmshake-prod');
    expect(DEVO_FIREBASE_PROJECT_ID).not.toBe(PROD_FIREBASE_PROJECT_ID);
  });

  it('denylists public prod hostnames for DEVO chrome', () => {
    expect(PROD_PUBLIC_HOSTNAMES.has('firm-shake.com')).toBe(true);
    expect(PROD_PUBLIC_HOSTNAMES.has('www.firm-shake.com')).toBe(true);
    expect(isProdPublicHostnameValue('Firm-Shake.COM')).toBe(true);
    expect(isProdPublicHostnameValue('firmshake-dev.web.app')).toBe(false);
  });

  it('normalizes trailing dots on hostnames', () => {
    expect(normalizeHostname('www.firm-shake.com.')).toBe('www.firm-shake.com');
  });

  it('keeps control panel deovo-only and staging API marker stable', () => {
    expect(CONTROLPANEL_HOSTING_ORIGIN).toBe('https://firmshake-controlpanel.web.app');
    expect(DEVO_API_HOST_MARKER).toBe('firmshake-api-staging');
  });
});
