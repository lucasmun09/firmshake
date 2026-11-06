import { useBffBrowse } from '@/common/config/featureFlags';
import {
  fetchCategoriesViaBff,
  getStaleCategoriesViaBff,
  invalidateCategoriesBffCache,
} from '@/features/listings/services/categoriesBff';
import {
  fetchCategories as fetchCategoriesFirestore,
  getStaleCategories as getStaleCategoriesFirestore,
  invalidateCategoriesCache as invalidateCategoriesFirestoreCache,
} from '@/features/listings/services/categories';

export async function fetchCategories(options?: { forceRefresh?: boolean }): Promise<
  import('@/types').Category[]
> {
  if (useBffBrowse()) {
    return fetchCategoriesViaBff({ forceRefresh: options?.forceRefresh, activeOnly: true });
  }
  return fetchCategoriesFirestore(options);
}

export function getStaleCategories(): import('@/types').Category[] | null {
  if (useBffBrowse()) {
    return getStaleCategoriesViaBff();
  }
  return getStaleCategoriesFirestore();
}

export function invalidateCategoriesCache(): void {
  if (useBffBrowse()) {
    invalidateCategoriesBffCache();
    return;
  }
  invalidateCategoriesFirestoreCache();
}

export {
  ensureCategoriesSeeded,
  getCategoryName,
  getCategoryById,
  subscribeCategories,
} from '@/features/listings/services/categories';
