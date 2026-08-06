import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Listing, UserProfile } from '@/types';

const useBffListings = vi.fn(() => false);
const createListingBff = vi.fn();
const updateListingBff = vi.fn();
const removeListingBff = vi.fn();
const createListingFirestore = vi.fn();
const updateListingFirestore = vi.fn();
const removeListingFirestore = vi.fn();
const getListingById = vi.fn();

vi.mock('@/common/config/featureFlags', () => ({
  useBffListings: () => useBffListings(),
}));

vi.mock('@/features/listings/services/listingBff', () => ({
  createListing: (...args: unknown[]) => createListingBff(...args),
  updateListing: (...args: unknown[]) => updateListingBff(...args),
  removeListing: (...args: unknown[]) => removeListingBff(...args),
}));

vi.mock('@/features/listings/services/listingFirestoreWrites', () => ({
  createListing: (...args: unknown[]) => createListingFirestore(...args),
  updateListing: (...args: unknown[]) => updateListingFirestore(...args),
  removeListing: (...args: unknown[]) => removeListingFirestore(...args),
}));

vi.mock('@/features/listings/services/listings', () => ({
  getListingById: (...args: unknown[]) => getListingById(...args),
}));

vi.mock('@/utils/moderation', () => ({
  canRemoveListing: () => true,
}));

const sampleListing: Listing = {
  id: 'listing-1',
  title: 'Desk',
  description: 'Solid wood',
  price: 100,
  imageUrl: '/api/images/a',
  imageUrls: ['/api/images/a'],
  sellerId: 'seller-1',
  sellerName: 'Seller',
  communityIds: ['all'],
  primaryCategoryId: 'furniture',
  categoryIds: ['furniture'],
  status: 'active',
};

const actor: UserProfile = {
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

describe('listingServiceRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBffListings.mockReturnValue(false);
    getListingById.mockResolvedValue(sampleListing);
    createListingBff.mockResolvedValue({ ...sampleListing, id: 'bff-new' });
    createListingFirestore.mockResolvedValue({ ...sampleListing, id: 'fs-new' });
    updateListingBff.mockResolvedValue(sampleListing);
    updateListingFirestore.mockResolvedValue(sampleListing);
    removeListingBff.mockResolvedValue({ ...sampleListing, status: 'removed' });
    removeListingFirestore.mockResolvedValue({ ...sampleListing, status: 'removed' });
  });

  it('routes create to Firestore when BFF flag is off', async () => {
    const { routeCreateListing } = await import('@/features/listings/services/listingServiceRouter');
    const input = {
      title: 'Chair',
      description: 'Comfy',
      price: 50,
      imageUrls: ['/api/images/b'],
      sellerId: 'seller-1',
      sellerName: 'Seller',
      communityIds: ['all'],
    };

    const result = await routeCreateListing(input);

    expect(createListingFirestore).toHaveBeenCalledWith(input);
    expect(createListingBff).not.toHaveBeenCalled();
    expect(result.id).toBe('fs-new');
  });

  it('routes create to BFF when flag is on', async () => {
    useBffListings.mockReturnValue(true);
    const { routeCreateListing } = await import('@/features/listings/services/listingServiceRouter');

    await routeCreateListing({
      title: 'Chair',
      description: 'Comfy',
      price: 50,
      imageUrls: ['/api/images/b'],
      sellerId: 'seller-1',
      sellerName: 'Seller',
      communityIds: ['all'],
    });

    expect(createListingBff).toHaveBeenCalledOnce();
    expect(createListingFirestore).not.toHaveBeenCalled();
  });

  it('routes update to BFF when flag is on', async () => {
    useBffListings.mockReturnValue(true);
    const { routeUpdateListing } = await import('@/features/listings/services/listingServiceRouter');

    await routeUpdateListing('listing-1', {
      title: 'Updated desk',
      description: 'Still solid',
      price: 120,
      imageUrls: ['/api/images/a'],
      communityIds: ['all'],
    });

    expect(updateListingBff).toHaveBeenCalledWith('listing-1', expect.objectContaining({
      title: 'Updated desk',
      primaryCategoryId: 'furniture',
    }));
    expect(updateListingFirestore).not.toHaveBeenCalled();
  });

  it('routes remove to Firestore when BFF flag is off', async () => {
    const { routeRemoveListing } = await import('@/features/listings/services/listingServiceRouter');

    await routeRemoveListing('listing-1', actor);

    expect(removeListingFirestore).toHaveBeenCalledWith('listing-1', actor, sampleListing);
    expect(removeListingBff).not.toHaveBeenCalled();
  });

  it('throws when listing is missing on update', async () => {
    getListingById.mockResolvedValue(null);
    const { routeUpdateListing } = await import('@/features/listings/services/listingServiceRouter');

    await expect(
      routeUpdateListing('missing', {
        title: 'Nope',
        description: 'Nope',
        price: 1,
        imageUrls: [],
        communityIds: ['all'],
      }),
    ).rejects.toThrow('Listing not found');
  });
});
