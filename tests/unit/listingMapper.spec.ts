import { describe, expect, it } from 'vitest';

import {
  listingWritePayload,
  mapListing,
  matchesListingKeyword,
  normalizeTitleLower,
} from '@/features/listings/utils/listingMapper';
import { buildListingSearchDocument } from '@/features/listings/utils/listingSearchDocument';

describe('listingMapper', () => {
  it('normalizes titleLower', () => {
    expect(normalizeTitleLower('  Vintage Lamp  ')).toBe('vintage lamp');
  });

  it('maps legacy listing documents with defaults', () => {
    const listing = mapListing('abc', {
      title: 'Desk Chair',
      description: 'Comfortable',
      price: 25,
      imageUrl: '/img/chair.jpg',
      sellerId: 'seller-1',
      sellerName: 'Alex',
      communityIds: ['all'],
      status: 'active',
    });

    expect(listing.primaryCategoryId).toBe('general');
    expect(listing.categoryIds).toEqual(['general']);
    expect(listing.titleLower).toBe('desk chair');
  });

  it('matches multi-word keyword queries', () => {
    expect(
      matchesListingKeyword(
        { title: 'Red Mountain Bike', description: 'Great condition' },
        'mountain bike',
      ),
    ).toBe(true);
    expect(
      matchesListingKeyword(
        { title: 'Red Mountain Bike', description: 'Great condition' },
        'blue car',
      ),
    ).toBe(false);
  });

  it('builds listing write payload with category and location fields', () => {
    const payload = listingWritePayload({
      title: 'Road Bike',
      description: 'Fast',
      price: 300,
      imageUrls: ['https://example.com/bike.jpg'],
      sellerId: 'seller-1',
      sellerName: 'Alex',
      communityIds: ['all'],
      primaryCategoryId: 'sports',
      categoryIds: ['sports'],
      location: {
        lat: 37.77,
        lng: -122.42,
        label: 'San Francisco',
      },
    });

    expect(payload.primaryCategoryId).toBe('sports');
    expect(payload.titleLower).toBe('road bike');
    expect(payload.geohash).toBeTruthy();
    expect(payload.locationLabel).toBe('San Francisco');
  });
});

describe('listingSearchDocument', () => {
  it('builds search document with geo fields', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const doc = buildListingSearchDocument({
      id: 'listing-1',
      title: 'Road Bike',
      description: 'Fast',
      price: 300,
      imageUrl: 'https://example.com/bike.jpg',
      imageUrls: ['https://example.com/bike.jpg'],
      sellerId: 'seller-1',
      sellerName: 'Alex',
      communityIds: ['all'],
      primaryCategoryId: 'sports',
      categoryIds: ['sports'],
      status: 'active',
      createdAt,
      location: {
        lat: 37.77,
        lng: -122.42,
        geohash: '9q8yyk',
        city: 'San Francisco',
      },
    });

    expect(doc.location).toEqual([37.77, -122.42]);
    expect(doc.geohash).toBe('9q8yyk');
    expect(doc.createdAt).toBe(createdAt.getTime());
  });
});
