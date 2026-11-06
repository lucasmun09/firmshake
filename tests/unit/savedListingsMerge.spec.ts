import { describe, expect, it } from 'vitest';

import type {
  SavedListingEntry,
  SavedListingTombstone,
} from '@/features/listings/services/savedListings';
import {
  mergeSavedListingEntries,
  mergeSavedListingsState,
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

function tomb(id: string, deletedAt: number): SavedListingTombstone {
  return { id, deletedAt };
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

  it('lets a local tombstone suppress a stale remote save and schedule a remote tombstone', () => {
    const result = mergeSavedListingsState(
      [],
      [tomb('a', 300)],
      [entry('a', 100)],
      [],
    );

    expect(result.entries).toEqual([]);
    expect(result.tombstones).toEqual([tomb('a', 300)]);
    expect(result.toUpsert).toEqual([]);
    expect(result.toTombstone).toEqual([tomb('a', 300)]);
  });

  it('lets a newer remote save beat a local tombstone', () => {
    const result = mergeSavedListingsState(
      [],
      [tomb('a', 100)],
      [entry('a', 200)],
      [],
    );

    expect(result.entries).toEqual([entry('a', 200)]);
    expect(result.tombstones).toEqual([]);
    expect(result.toUpsert).toEqual([]);
    expect(result.toTombstone).toEqual([]);
  });

  it('propagates a remote tombstone over a stale local save', () => {
    const result = mergeSavedListingsState(
      [entry('a', 50)],
      [],
      [],
      [tomb('a', 90)],
    );

    expect(result.entries).toEqual([]);
    expect(result.tombstones).toEqual([tomb('a', 90)]);
    expect(result.toUpsert).toEqual([]);
    expect(result.toTombstone).toEqual([]);
  });

  it('skips remote tombstone writes when remote already has the same delete', () => {
    const result = mergeSavedListingsState(
      [],
      [tomb('a', 100)],
      [],
      [tomb('a', 100)],
    );

    expect(result.toTombstone).toEqual([]);
    expect(result.tombstones).toEqual([tomb('a', 100)]);
  });

  it('upserts local-only saves and tombstones that beat remote', () => {
    const result = mergeSavedListingsState(
      [entry('local', 10), entry('both', 30)],
      [tomb('gone', 40)],
      [entry('both', 20), entry('gone', 5)],
      [],
    );

    expect(result.entries.map((item) => item.id).sort()).toEqual(['both', 'local']);
    expect(result.toUpsert.map((item) => item.id).sort()).toEqual(['both', 'local']);
    expect(result.toTombstone).toEqual([tomb('gone', 40)]);
  });
});
