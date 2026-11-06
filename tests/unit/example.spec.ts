import { describe, expect, it } from 'vitest';

describe('data format smoke tests', () => {
  it('category seed ids are unique', async () => {
    const { SEED_CATEGORIES } = await import('@/features/listings/data/seedCategories');
    const ids = SEED_CATEGORIES.map((category) => category.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
