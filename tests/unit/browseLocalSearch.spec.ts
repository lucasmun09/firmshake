import { describe, expect, it } from 'vitest';

import { ALL_COMMUNITY_ID } from '@/features/communities/data/seedCommunities';
import {
  appendUniqueBrowseListings,
  filterLoadedBrowseListings,
  mergeBrowseListingsById,
} from '@/features/listings/utils/browseLocalSearch';
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
    communityIds: overrides.communityIds ?? [ALL_COMMUNITY_ID],
    primaryCategoryId: overrides.primaryCategoryId ?? 'general',
    categoryIds: overrides.categoryIds ?? ['general'],
    status: overrides.status ?? 'active',
    createdAt: overrides.createdAt,
    location: overrides.location,
  };
}

describe('browseLocalSearch', () => {
  it('filters loaded listings by keyword', () => {
    const listings = [
      sampleListing('bike', { title: 'Mountain Bike' }),
      sampleListing('desk', { title: 'Office Desk' }),
    ];

    const filtered = filterLoadedBrowseListings(listings, { query: 'bike' });
    expect(filtered.map((listing) => listing.id)).toEqual(['bike']);
  });

  it('applies category and price filters locally', () => {
    const listings = [
      sampleListing('cheap-chair', {
        title: 'Office Chair',
        price: 25,
        primaryCategoryId: 'furniture',
        categoryIds: ['furniture'],
      }),
      sampleListing('expensive-chair', {
        title: 'Office Chair Deluxe',
        price: 250,
        primaryCategoryId: 'furniture',
        categoryIds: ['furniture'],
      }),
      sampleListing('other', {
        title: 'Office Lamp',
        price: 15,
        primaryCategoryId: 'lighting',
        categoryIds: ['lighting'],
      }),
    ];

    const filtered = filterLoadedBrowseListings(listings, {
      query: 'office',
      categoryId: 'furniture',
      priceMin: 20,
      priceMax: 100,
    });

    expect(filtered.map((listing) => listing.id)).toEqual(['cheap-chair']);
  });

  it('filters by community membership', () => {
    const listings = [
      sampleListing('all', { title: 'Shared Bike', communityIds: [ALL_COMMUNITY_ID] }),
      sampleListing('neighborhood', {
        title: 'Neighborhood Bike',
        communityIds: ['neighborhood'],
      }),
    ];

    const filtered = filterLoadedBrowseListings(listings, {
      communityId: 'neighborhood',
      query: 'bike',
    });

    expect(filtered.map((listing) => listing.id)).toEqual(['neighborhood']);
  });

  it('applies geo filter together with keyword search', () => {
    const listings = [
      sampleListing('nearby', {
        title: 'Apple Bike',
        location: { lat: 38.7512726, lng: -77.4706769 },
      }),
      sampleListing('far-away', {
        title: 'Apple Scooter',
        location: { lat: 37.7749, lng: -122.4194 },
      }),
    ];

    const filtered = filterLoadedBrowseListings(listings, {
      query: 'apple',
      geo: {
        lat: 38.76576535362319,
        lng: -77.4706769,
        radiusKm: milesToKm(25),
      },
    });

    expect(filtered.map((listing) => listing.id)).toEqual(['nearby']);
  });

  it('sorts by price when there is no keyword query', () => {
    const listings = [
      sampleListing('expensive', { title: 'A', price: 100 }),
      sampleListing('cheap', { title: 'B', price: 10 }),
    ];

    const filtered = filterLoadedBrowseListings(listings, { sort: 'price_asc' });
    expect(filtered.map((listing) => listing.id)).toEqual(['cheap', 'expensive']);
  });

  it('merges listings by id with incoming winning', () => {
    const existing = [sampleListing('1', { title: 'Old title', price: 10 })];
    const incoming = [sampleListing('1', { title: 'New title', price: 20 })];

    const merged = mergeBrowseListingsById(existing, incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.title).toBe('New title');
    expect(merged[0]?.price).toBe(20);
  });

  it('appends unique listings without duplicates', () => {
    const existing = [sampleListing('1'), sampleListing('2')];
    const incoming = [sampleListing('2'), sampleListing('3')];

    const appended = appendUniqueBrowseListings(existing, incoming);
    expect(appended.map((listing) => listing.id)).toEqual(['1', '2', '3']);
  });
});
