import { describe, expect, it } from 'vitest';

import { getBlockCancelAction } from '@/common/services/agreements';
import type { Agreement } from '@/types';

function agreement(overrides: Partial<Agreement> = {}): Agreement {
  return {
    id: 'agreement-1',
    listingId: 'listing-1',
    buyerId: 'buyer-1',
    buyerName: 'Buyer',
    sellerId: 'seller-1',
    price: 100,
    meetupLat: 0,
    meetupLng: 0,
    depositAmount: 10,
    status: 'proposed',
    ...overrides,
  };
}

describe('getBlockCancelAction', () => {
  it('returns buyer cancel for a proposed agreement owned by the buyer', () => {
    expect(getBlockCancelAction(agreement(), 'buyer-1')).toBe('buyer-cancel-proposed');
  });

  it('returns seller decline for a proposed agreement owned by the seller', () => {
    expect(getBlockCancelAction(agreement(), 'seller-1')).toBe('seller-decline-proposed');
  });

  it('returns direct cancel for accepted agreements by either participant', () => {
    const accepted = agreement({ status: 'accepted' });
    expect(getBlockCancelAction(accepted, 'buyer-1')).toBe('direct-cancel');
    expect(getBlockCancelAction(accepted, 'seller-1')).toBe('direct-cancel');
  });

  it('returns null for inactive agreements and unrelated users', () => {
    expect(getBlockCancelAction(agreement({ status: 'cancelled' }), 'buyer-1')).toBeNull();
    expect(getBlockCancelAction(agreement(), 'other-user')).toBeNull();
  });
});
