import { describe, expect, it } from 'vitest';

import {
  guestTabFeatureLabel,
  isGuestProtectedTabPath,
} from '@/common/services/guestAuthUi';

describe('guestAuthUi', () => {
  it('identifies protected tab paths', () => {
    expect(isGuestProtectedTabPath('/tabs/buying')).toBe(true);
    expect(isGuestProtectedTabPath('/tabs/buying/')).toBe(true);
    expect(isGuestProtectedTabPath('/tabs/home')).toBe(false);
  });

  it('maps tab paths to feature labels', () => {
    expect(guestTabFeatureLabel('/tabs/inbox')).toBe('Inbox');
    expect(guestTabFeatureLabel('/tabs/sell')).toBe('Sell');
  });
});
