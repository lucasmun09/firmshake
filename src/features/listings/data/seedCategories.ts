import type { Category } from '@/types';

export const UNCATEGORIZED_ID = 'general';

export const SEED_CATEGORIES: Category[] = [
  { id: 'general', name: 'General', slug: 'general', sortOrder: 0 },
  { id: 'electronics', name: 'Electronics', slug: 'electronics', sortOrder: 10 },
  { id: 'phones', name: 'Phones & Tablets', slug: 'phones', parentId: 'electronics', sortOrder: 11 },
  { id: 'computers', name: 'Computers', slug: 'computers', parentId: 'electronics', sortOrder: 12 },
  { id: 'home', name: 'Home & Garden', slug: 'home', sortOrder: 20 },
  { id: 'furniture', name: 'Furniture', slug: 'furniture', parentId: 'home', sortOrder: 21 },
  { id: 'clothing', name: 'Clothing & Accessories', slug: 'clothing', sortOrder: 30 },
  { id: 'sports', name: 'Sports & Outdoors', slug: 'sports', sortOrder: 40 },
  { id: 'vehicles', name: 'Vehicles', slug: 'vehicles', sortOrder: 50 },
  { id: 'books', name: 'Books & Media', slug: 'books', sortOrder: 60 },
  { id: 'toys', name: 'Toys & Games', slug: 'toys', sortOrder: 70 },
  { id: 'services', name: 'Services', slug: 'services', sortOrder: 80 },
];

export function getDefaultCategoryId(): string {
  return UNCATEGORIZED_ID;
}
