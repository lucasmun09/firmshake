import { describe, expect, it } from 'vitest';

import type { Listing, UserProfile } from '@/types';
import { canMarkListingSold, canRemoveListing } from '@/utils/moderation';

const listing: Listing = {
  id: 'listing-1',
  title: 'Bike',
  description: 'Trail',
  price: 100,
  imageUrl: '/img.jpg',
  imageUrls: ['/img.jpg'],
  sellerId: 'seller-1',
  sellerName: 'Sam',
  communityIds: ['neighborhood-a'],
  primaryCategoryId: 'sports',
  categoryIds: ['sports'],
  status: 'active',
};

const seller: UserProfile = {
  uid: 'seller-1',
  email: 'seller@example.com',
  firstName: 'Sam',
  lastName: 'Seller',
  displayName: 'Sam Seller',
  communityIds: ['all'],
  isAdmin: false,
  isSuperAdmin: false,
  moderatorCommunityIds: [],
};

const moderator: UserProfile = {
  ...seller,
  uid: 'mod-1',
  moderatorCommunityIds: ['neighborhood-a'],
};

describe('canMarkListingSold', () => {
  it('allows only the seller of an active listing', () => {
    expect(canMarkListingSold(seller, listing)).toBe(true);
    expect(canMarkListingSold(moderator, listing)).toBe(false);
    expect(canMarkListingSold(seller, { ...listing, status: 'sold' })).toBe(false);
    expect(canMarkListingSold(seller, { ...listing, status: 'removed' })).toBe(false);
  });

  it('does not grant moderators mark-sold even when they can remove', () => {
    expect(canRemoveListing(moderator, listing)).toBe(true);
    expect(canMarkListingSold(moderator, listing)).toBe(false);
  });
});
