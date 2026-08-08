import { loggedFetch } from '@/common/debug/loggedFetch';
import { authHeaders } from '@/common/services/api';
import { SEED_CATEGORIES } from '@/features/listings/data/seedCategories';
import {
  buildCacheKey,
  getCached,
  getStaleCached,
  invalidateCached,
  setCached,
} from '@/common/services/responseCache';
import { getApiBaseUrl, isApiConfigured } from '@/utils/apiBaseUrl';
import type { Category } from '@/types';

const CATEGORIES_CACHE_KEY = buildCacheKey('categories-bff', { tab: 'all' });

function mapCategory(entry: Record<string, unknown>): Category {
  return {
    id: String(entry.id ?? ''),
    name: String(entry.name ?? entry.id ?? ''),
    slug: String(entry.slug ?? entry.id ?? ''),
    parentId: entry.parentId ? String(entry.parentId) : undefined,
    sortOrder: entry.sortOrder != null ? Number(entry.sortOrder) : undefined,
  };
}

export async function fetchCategoriesViaBff(options?: {
  forceRefresh?: boolean;
  activeOnly?: boolean;
}): Promise<Category[]> {
  if (!isApiConfigured()) {
    return SEED_CATEGORIES;
  }

  if (!options?.forceRefresh) {
    const cached = getCached<Category[]>(CATEGORIES_CACHE_KEY);
    if (cached) {
      return cached;
    }
  }

  const query = options?.activeOnly ? '?active=true' : '';
  const headers: Record<string, string> = {};
  const auth = await authHeaders();
  if (typeof auth === 'object' && auth && 'Authorization' in auth && auth.Authorization) {
    headers.Authorization = String(auth.Authorization);
  }

  const response = await loggedFetch(
    `${getApiBaseUrl()}/api/v1/categories${query}`,
    { headers },
    { category: 'listing', label: 'GET /api/v1/categories' },
  );

  if (!response.ok) {
    throw new Error('Categories are temporarily unavailable');
  }

  const payload = (await response.json()) as { categories: Record<string, unknown>[] };
  const categories = (payload.categories ?? []).map(mapCategory);
  const resolved = categories.length ? categories : SEED_CATEGORIES;
  setCached(CATEGORIES_CACHE_KEY, resolved);
  return resolved;
}

export function getStaleCategoriesViaBff(): Category[] | null {
  return getStaleCached<Category[]>(CATEGORIES_CACHE_KEY);
}

export function invalidateCategoriesBffCache(): void {
  invalidateCached(CATEGORIES_CACHE_KEY);
}
