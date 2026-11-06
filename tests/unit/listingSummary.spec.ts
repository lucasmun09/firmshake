import { describe, expect, it } from 'vitest';

import {
  listingSummaryToListing,
  summarizeListings,
  toListingSummary,
} from '@/features/listings/utils/listingSummary';
import type { Listing } from '@/types';

function makeListing(id: string): Listing {
  return {
    id,
    title: `Item ${id}`,
    titleLower: `item ${id}`,
    description: 'Full description with lots of detail text.',
    price: 42,
    imageUrl: 'https://example.com/primary.jpg',
    imageUrls: ['https://example.com/primary.jpg', 'https://example.com/extra.jpg'],
    sellerId: 'seller-1',
    sellerName: 'Jane Seller',
    communityIds: ['all'],
    primaryCategoryId: 'general',
    categoryIds: ['general', 'tools'],
    status: 'active',
    createdAt: new Date('2026-01-15T12:00:00.000Z'),
    location: { lat: 37.77, lng: -122.42, city: 'San Francisco' },
  };
}

describe('listingSummary', () => {
  it('strips detail fields from a full listing', () => {
    const summary = toListingSummary(makeListing('abc'));

    expect(summary).toEqual({
      id: 'abc',
      title: 'Item abc',
      price: 42,
      imageUrl: 'https://example.com/primary.jpg',
      status: 'active',
      sellerId: 'seller-1',
      communityIds: ['all'],
      primaryCategoryId: 'general',
      createdAt: new Date('2026-01-15T12:00:00.000Z'),
      location: { lat: 37.77, lng: -122.42, city: 'San Francisco' },
    });
    expect(summary).not.toHaveProperty('description');
    expect(summary).not.toHaveProperty('imageUrls');
    expect(summary).not.toHaveProperty('sellerName');
  });

  it('revives a summary into a Listing with empty detail defaults', () => {
    const revived = listingSummaryToListing(toListingSummary(makeListing('xyz')));

    expect(revived.id).toBe('xyz');
    expect(revived.title).toBe('Item xyz');
    expect(revived.description).toBe('');
    expect(revived.imageUrls).toEqual(['https://example.com/primary.jpg']);
    expect(revived.sellerName).toBe('Unknown seller');
    expect(revived.categoryIds).toEqual(['general']);
  });

  it('summarizeListings maps arrays', () => {
    const summaries = summarizeListings([makeListing('a'), makeListing('b')]);
    expect(summaries.map((summary) => summary.id)).toEqual(['a', 'b']);
  });
});
