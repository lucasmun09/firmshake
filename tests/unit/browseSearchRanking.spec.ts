import { describe, expect, it } from 'vitest';

import {
  listingSearchRelevanceScore,
  matchesListingSearchQuery,
  normalizeSearchQuery,
  sortListingsBySearchRelevance,
} from '@/features/listings/utils/browseSearchRanking';
import type { Listing } from '@/types';

function listing(partial: Partial<Listing> & Pick<Listing, 'title'>): Listing {
  return {
    id: partial.id ?? '1',
    title: partial.title,
    titleLower: partial.title.toLowerCase(),
    description: partial.description ?? '',
    price: partial.price ?? 10,
    imageUrl: partial.imageUrl ?? '',
    imageUrls: partial.imageUrls ?? [],
    sellerId: partial.sellerId ?? 'seller',
    sellerName: partial.sellerName ?? 'Seller',
    communityIds: partial.communityIds ?? ['all'],
    primaryCategoryId: partial.primaryCategoryId ?? 'general',
    categoryIds: partial.categoryIds ?? ['general'],
    status: partial.status ?? 'active',
    createdAt: partial.createdAt,
  };
}

describe('browseSearchRanking', () => {
  it('normalizes whitespace and case in queries', () => {
    expect(normalizeSearchQuery('  Office   Chair ')).toBe('office chair');
  });

  it('ranks exact title matches highest', () => {
    const exact = listingSearchRelevanceScore(listing({ title: 'Office Chair' }), 'office chair');
    const contains = listingSearchRelevanceScore(listing({ title: 'Used Office Chair Set' }), 'office chair');
    expect(exact).toBeGreaterThan(contains);
  });

  it('ranks starts-with above contains', () => {
    const startsWith = listingSearchRelevanceScore(listing({ title: 'Office supplies bundle' }), 'office');
    const contains = listingSearchRelevanceScore(listing({ title: 'Home office desk' }), 'office');
    expect(startsWith).toBeGreaterThan(contains);
  });

  it('matches seller name when title does not match', () => {
    expect(
      matchesListingSearchQuery(listing({ title: 'Desk lamp', sellerName: 'Office Depot' }), 'office'),
    ).toBe(true);
  });

  it('does not match description-only hits', () => {
    expect(
      matchesListingSearchQuery(
        listing({ title: 'Desk lamp', description: 'Perfect for your office setup' }),
        'office',
      ),
    ).toBe(false);
  });

  it('sorts by relevance then recency', () => {
    const olderExact = listing({
      id: 'older',
      title: 'Office',
      createdAt: new Date('2024-01-01'),
    });
    const newerPartial = listing({
      id: 'newer',
      title: 'Office chair',
      createdAt: new Date('2025-01-01'),
    });

    const sorted = sortListingsBySearchRelevance([newerPartial, olderExact], 'office');
    expect(sorted.map((item) => item.id)).toEqual(['older', 'newer']);
  });
});
