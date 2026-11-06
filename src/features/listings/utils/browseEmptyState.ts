/**
 * Browse empty-state copy + whether restrictive filters/search are active.
 * Kept pure so HomePage and tests share the same UX rules.
 */

export type BrowseEmptyStateInput = {
  communityName: string;
  searchQuery?: string | null;
  categoryId?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  geoActive?: boolean;
  geoLabel?: string | null;
  geoRadiusMiles?: number | null;
};

export type BrowseEmptyState = {
  hasRestrictiveFilters: boolean;
  message: string;
  hint: string;
  showClearFilters: boolean;
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function browseHasRestrictiveFilters(input: BrowseEmptyStateInput): boolean {
  return (
    hasText(input.searchQuery) ||
    hasText(input.categoryId) ||
    input.priceMin != null ||
    input.priceMax != null ||
    Boolean(input.geoActive)
  );
}

export function resolveBrowseEmptyState(input: BrowseEmptyStateInput): BrowseEmptyState {
  const restrictive = browseHasRestrictiveFilters(input);
  const query = input.searchQuery?.trim() ?? '';

  if (input.geoActive) {
    const center = hasText(input.geoLabel) ? input.geoLabel!.trim() : 'your location';
    const miles = input.geoRadiusMiles ?? 0;
    return {
      hasRestrictiveFilters: true,
      message: `No listings within ${miles} mi of ${center}.`,
      hint: 'Try increasing the radius, clearing filters, or choosing a different location.',
      showClearFilters: true,
    };
  }

  if (query) {
    return {
      hasRestrictiveFilters: true,
      message: `No listings match “${query}”.`,
      hint: 'Clear search or adjust filters to see more results.',
      showClearFilters: true,
    };
  }

  if (restrictive) {
    return {
      hasRestrictiveFilters: true,
      message: `No listings match your filters in ${input.communityName}.`,
      hint: 'Clear filters to see everything in this community.',
      showClearFilters: true,
    };
  }

  return {
    hasRestrictiveFilters: false,
    message: `No listings yet in ${input.communityName}.`,
    hint: 'Be the first to list something for sale.',
    showClearFilters: false,
  };
}
