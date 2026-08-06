import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { SEED_CATEGORIES } from '@/features/listings/data/seedCategories';
import type { Category } from '@/types';
import { auth, db } from '@/common/services/firebase';
import {
  createFirestoreSnapshotErrorHandler,
  handleFirestorePermissionDenied,
  isSessionExpiredError,
} from '@/common/services/firestoreAuth';
import {
  buildCacheKey,
  getCached,
  getStaleCached,
  invalidateCached,
  setCached,
} from '@/common/services/responseCache';

const CATEGORIES_CACHE_KEY = buildCacheKey('categories', { tab: 'all' });

function mapCategory(id: string, data: Record<string, unknown>): Category {
  return {
    id,
    name: String(data.name ?? id),
    slug: String(data.slug ?? id),
    parentId: data.parentId ? String(data.parentId) : undefined,
    sortOrder: data.sortOrder != null ? Number(data.sortOrder) : undefined,
  };
}

export async function ensureCategoriesSeeded(): Promise<void> {
  if (!db || !auth?.currentUser) {
    return;
  }

  try {
    const existing = await getDocs(query(collection(db, 'categories'), orderBy('sortOrder')));
    if (existing.size >= SEED_CATEGORIES.length) {
      return;
    }

    await Promise.all(
      SEED_CATEGORIES.map((category) =>
        setDoc(doc(db!, 'categories', category.id), category, { merge: true }),
      ),
    );
  } catch (error) {
    if (isSessionExpiredError(error)) {
      return;
    }

    const handled = await handleFirestorePermissionDenied(error, 'ensureCategoriesSeeded');
    if (handled) {
      return;
    }

    throw error;
  }
}

export async function fetchCategories(options?: { forceRefresh?: boolean }): Promise<Category[]> {
  if (!db) {
    return SEED_CATEGORIES;
  }

  if (!options?.forceRefresh) {
    const cached = getCached<Category[]>(CATEGORIES_CACHE_KEY);
    if (cached) {
      return cached;
    }
  }

  const snapshot = await getDocs(query(collection(db, 'categories'), orderBy('sortOrder')));
  if (snapshot.empty) {
    setCached(CATEGORIES_CACHE_KEY, SEED_CATEGORIES);
    return SEED_CATEGORIES;
  }

  const categories = snapshot.docs.map((entry) =>
    mapCategory(entry.id, entry.data() as Record<string, unknown>),
  );
  setCached(CATEGORIES_CACHE_KEY, categories);
  return categories;
}

export function getStaleCategories(): Category[] | null {
  return getStaleCached<Category[]>(CATEGORIES_CACHE_KEY);
}

export function invalidateCategoriesCache(): void {
  invalidateCached(CATEGORIES_CACHE_KEY);
}

export function subscribeCategories(
  onData: (categories: Category[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!db) {
    onData(SEED_CATEGORIES);
    return () => undefined;
  }

  return onSnapshot(
    query(collection(db, 'categories'), orderBy('sortOrder')),
    (snapshot) => {
      if (snapshot.empty) {
        onData(SEED_CATEGORIES);
        return;
      }
      onData(snapshot.docs.map((entry) => mapCategory(entry.id, entry.data() as Record<string, unknown>)));
    },
    createFirestoreSnapshotErrorHandler(onError, 'subscribeCategories'),
  );
}

export function getCategoryName(categories: Category[], categoryId: string): string {
  const match =
    categories.find((category) => category.id === categoryId) ??
    SEED_CATEGORIES.find((category) => category.id === categoryId);
  return match?.name ?? 'General';
}

export async function getCategoryById(categoryId: string): Promise<Category | null> {
  if (!db) {
    return SEED_CATEGORIES.find((category) => category.id === categoryId) ?? null;
  }

  const snapshot = await getDoc(doc(db, 'categories', categoryId));
  if (!snapshot.exists()) {
    return SEED_CATEGORIES.find((category) => category.id === categoryId) ?? null;
  }

  return mapCategory(snapshot.id, snapshot.data() as Record<string, unknown>);
}
