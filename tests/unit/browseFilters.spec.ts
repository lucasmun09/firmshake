import { describe, expect, it } from 'vitest';

import { applyBrowseFilters } from '@/features/listings/utils/browseFilters';
import { milesToKm } from '@/features/listings/utils/geoDistance';
import type { Listing } from '@/types';

function sampleListing(
  id: string,
  overrides: Partial<Listing> = {},
): Listing {
  return {
    id,
    title: overrides.title ?? `Listing ${id}`,
    titleLower: (overrides.title ?? `Listing ${id}`).toLowerCase(),
    description: overrides.description ?? 'Description',
    price: overrides.price ?? 10,
    imageUrl: overrides.imageUrl ?? '',
    imageUrls: overrides.imageUrls ?? [],
    sellerId: overrides.sellerId ?? 'seller',
    sellerName: overrides.sellerName ?? 'Seller',
    communityIds: overrides.communityIds ?? ['all'],
    primaryCategoryId: overrides.primaryCategoryId ?? 'general',
    categoryIds: overrides.categoryIds ?? ['general'],
    status: overrides.status ?? 'active',
    location: overrides.location,
  };
}

describe('browseFilters', () => {
  it('excludes listings without coordinates from geo filter results', () => {
    const listings = [
      sampleListing('nearby', {
        location: { lat: 38.7512726, lng: -77.4706769 },
      }),
      sampleListing('missing-location'),
    ];

    const filtered = applyBrowseFilters(listings, {
      geo: {
        lat: 38.76576535362319,
        lng: -77.4706769,
        radiusKm: milesToKm(25),
      },
    });

    expect(filtered.map((listing) => listing.id)).toEqual(['nearby']);
  });

  it('includes listings within the configured radius', () => {
    const listings = [
      sampleListing('nearby', {
        location: { lat: 38.7512726, lng: -77.4706769 },
      }),
      sampleListing('far-away', {
        location: { lat: 37.7749, lng: -122.4194 },
      }),
    ];

    const filtered = applyBrowseFilters(listings, {
      geo: {
        lat: 38.76576535362319,
        lng: -77.4706769,
        radiusKm: milesToKm(25),
      },
    });

    expect(filtered.map((listing) => listing.id)).toEqual(['nearby']);
  });

  it('applies keyword and geo filters together', () => {
    const listings = [
      sampleListing('apple', {
        title: 'Apple Sauce',
        location: { lat: 38.7512726, lng: -77.4706769 },
      }),
      sampleListing('bike', {
        title: 'Mountain Bike',
        location: { lat: 38.7512726, lng: -77.4706769 },
      }),
    ];

    const filtered = applyBrowseFilters(listings, {
      query: 'apple',
      geo: {
        lat: 38.76576535362319,
        lng: -77.4706769,
        radiusKm: milesToKm(25),
      },
    });

    expect(filtered.map((listing) => listing.id)).toEqual(['apple']);
  });
});
