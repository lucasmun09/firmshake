import { describe, expect, it } from 'vitest';

import { sellerProfileFromListings } from '@/features/listings/utils/sellerPublicProfile';

describe('sellerProfileFromListings', () => {
  it('derives display name and count from active listings', () => {
    const profile = sellerProfileFromListings('seller-1', [
      { sellerId: 'seller-1', sellerName: 'Ada Lovelace' },
      { sellerId: 'seller-1', sellerName: 'Ada Lovelace' },
      { sellerId: 'other', sellerName: 'Ignored' },
    ]);

    expect(profile).toEqual({
      sellerId: 'seller-1',
      displayName: 'Ada Lovelace',
      photoUrl: undefined,
      activeListingCount: 2,
    });
  });

  it('falls back to FirmShake User and accepts overrides', () => {
    expect(sellerProfileFromListings('s1', [])).toMatchObject({
      displayName: 'FirmShake User',
      activeListingCount: 0,
    });

    expect(
      sellerProfileFromListings('s1', [{ sellerId: 's1', sellerName: 'From listing' }], {
        displayName: 'Override',
        photoUrl: 'https://cdn/x.png',
      }),
    ).toMatchObject({
      displayName: 'Override',
      photoUrl: 'https://cdn/x.png',
    });
  });
});
