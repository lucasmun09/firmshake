import { describe, expect, it } from 'vitest';

import type { SavedListingEntry } from '@/features/listings/services/savedListings';
import {
  mergeSavedListingEntries,
  savedListingsMissingFromRemote,
} from '@/features/listings/services/savedListingsMerge';

function entry(id: string, savedAt: number): SavedListingEntry {
  return {
    id,
    title: `Listing ${id}`,
    price: 10,
    imageUrl: `https://example.com/${id}.jpg`,
    savedAt,
  };
}

describe('savedListingsMerge', () => {
  it('unions by id and keeps newer savedAt', () => {
    const merged = mergeSavedListingEntries(
      [entry('a', 100), entry('b', 50)],
      [entry('a', 200), entry('c', 150)],
    );

    expect(merged.map((item) => item.id)).toEqual(['a', 'c', 'b']);
    expect(merged.find((item) => item.id === 'a')?.savedAt).toBe(200);
  });

  it('trims to max newest-first', () => {
    const local = [entry('a', 1), entry('b', 2), entry('c', 3)];
    const remote = [entry('d', 4)];
    const merged = mergeSavedListingEntries(local, remote, 2);
    expect(merged).toHaveLength(2);
    expect(merged.map((item) => item.id)).toEqual(['d', 'c']);
  });

  it('lists local-only rows missing from remote', () => {
    const merged = [entry('a', 1), entry('b', 2)];
    const remote = [entry('a', 1)];
    expect(savedListingsMissingFromRemote(merged, remote).map((item) => item.id)).toEqual(['b']);
  });
});
