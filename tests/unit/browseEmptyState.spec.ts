import { describe, expect, it } from 'vitest';

import { resolveBrowseEmptyState } from '@/features/listings/utils/browseEmptyState';

describe('resolveBrowseEmptyState', () => {
  it('shows sell CTA hint when community is empty with no filters', () => {
    const state = resolveBrowseEmptyState({ communityName: 'All' });
    expect(state.showClearFilters).toBe(false);
    expect(state.message).toContain('All');
    expect(state.hint).toMatch(/first to list/i);
  });

  it('offers clear filters when search has no hits', () => {
    const state = resolveBrowseEmptyState({
      communityName: 'All',
      searchQuery: 'vintage lamp',
    });
    expect(state.showClearFilters).toBe(true);
    expect(state.message).toContain('vintage lamp');
  });

  it('offers clear filters for geo-empty results', () => {
    const state = resolveBrowseEmptyState({
      communityName: 'All',
      geoActive: true,
      geoLabel: 'Ann Arbor',
      geoRadiusMiles: 10,
    });
    expect(state.showClearFilters).toBe(true);
    expect(state.message).toContain('10 mi');
    expect(state.message).toContain('Ann Arbor');
  });

  it('offers clear filters for category/price without search', () => {
    const state = resolveBrowseEmptyState({
      communityName: 'Campus',
      categoryId: 'furniture',
      priceMin: 10,
    });
    expect(state.showClearFilters).toBe(true);
    expect(state.message).toContain('Campus');
  });
});
