import type { Listing } from '@/types';

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Higher score = stronger match. Title > seller name > description body.
 * exact > starts-with > all tokens in title > any token in title > seller > description.
 */
export function listingSearchRelevanceScore(
  listing: Pick<Listing, 'title' | 'sellerName' | 'description'>,
  query: string,
): number {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) {
    return 0;
  }

  const title = (listing.title ?? '').trim().toLowerCase();
  const seller = (listing.sellerName ?? '').trim().toLowerCase();
  const description = (listing.description ?? '').trim().toLowerCase();
  const terms = normalized.split(' ').filter(Boolean);

  if (title === normalized) {
    return 1000;
  }
  if (title.startsWith(normalized)) {
    return 900;
  }
  if (terms.every((term) => title.includes(term))) {
    const firstIndex = Math.min(
      ...terms.map((term) => {
        const index = title.indexOf(term);
        return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
      }),
    );
    return 800 - Math.min(firstIndex, 99);
  }
  if (terms.some((term) => title.includes(term))) {
    return 500;
  }
  if (terms.every((term) => seller.includes(term))) {
    return 300;
  }
  if (terms.some((term) => seller.includes(term))) {
    return 200;
  }
  if (terms.every((term) => description.includes(term))) {
    return 100;
  }
  if (terms.some((term) => description.includes(term))) {
    return 50;
  }

  return 0;
}

export function matchesListingSearchQuery(
  listing: Pick<Listing, 'title' | 'sellerName' | 'description'>,
  query: string,
): boolean {
  return listingSearchRelevanceScore(listing, query) > 0;
}

export function sortListingsBySearchRelevance<
  T extends Pick<Listing, 'title' | 'sellerName' | 'description' | 'createdAt'>,
>(listings: T[], query: string): T[] {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) {
    return listings;
  }

  return [...listings].sort((left, right) => {
    const scoreDelta =
      listingSearchRelevanceScore(right, normalized) -
      listingSearchRelevanceScore(left, normalized);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    const leftCreated = left.createdAt?.getTime() ?? 0;
    const rightCreated = right.createdAt?.getTime() ?? 0;
    return rightCreated - leftCreated;
  });
}
