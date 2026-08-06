import { describe, expect, it } from 'vitest';

import { resolveBlockedDisplayName } from '@/common/services/blockUi';

describe('resolveBlockedDisplayName', () => {
  it('uses participant profile display name when available', () => {
    expect(
      resolveBlockedDisplayName('user-1', {
        'user-1': { displayName: 'Alex Buyer' },
      }),
    ).toBe('Alex Buyer');
  });

  it('falls back when profile is missing', () => {
    expect(resolveBlockedDisplayName('user-1', {}, 'Seller Name')).toBe('Seller Name');
  });

  it('uses default fallback label', () => {
    expect(resolveBlockedDisplayName('user-1', {})).toBe('FirmShake User');
  });
});
