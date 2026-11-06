import { describe, expect, it } from 'vitest';

import {
  resolveSmsBypassNavigation,
  resolveSmsBypassToastKind,
  smsBypassToastMessage,
} from '@/common/debug/smsBypassNavigation';

describe('resolveSmsBypassNavigation', () => {
  it('never leaves MFA challenge (pending Firebase second factor)', () => {
    expect(resolveSmsBypassNavigation('/mfa-challenge', false)).toBeNull();
    expect(resolveSmsBypassNavigation('/mfa-challenge', true)).toBeNull();
  });

  it('sends enrolled-bypass users home from MFA enroll when signed in', () => {
    expect(resolveSmsBypassNavigation('/mfa-enroll', true)).toBe('/tabs/home');
    expect(resolveSmsBypassNavigation('/mfa-enroll', false)).toBeNull();
  });

  it('does not navigate from unrelated routes', () => {
    expect(resolveSmsBypassNavigation('/tabs/home', true)).toBeNull();
    expect(resolveSmsBypassNavigation('/login', false)).toBeNull();
  });
});

describe('resolveSmsBypassToastKind', () => {
  it('warns on challenge instead of claiming success', () => {
    expect(
      resolveSmsBypassToastKind({
        path: '/mfa-challenge',
        accountSetupFinalized: true,
        uid: 'u1',
      }),
    ).toBe('challenge-blocked');
    expect(smsBypassToastMessage('challenge-blocked').color).toBe('warning');
  });
});
