import { describe, expect, it, vi } from 'vitest';

vi.mock('@/common/services/firebase', () => ({
  db: {},
}));

vi.mock('@/common/services/firestoreAuth', () => ({
  ensureFirestoreAuth: vi.fn(async () => undefined),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
}));

describe('savedListingsRemote', () => {
  it('maps active docs and soft-delete tombstones', async () => {
    const {
      mapSavedListingRemoteDoc,
      mapSavedListingRemoteTombstone,
      canSyncSavedListingsRemote,
    } = await import('@/features/listings/services/savedListingsRemote');

    expect(canSyncSavedListingsRemote('user-a')).toBe(true);
    expect(canSyncSavedListingsRemote('anonymous')).toBe(false);

    expect(
      mapSavedListingRemoteDoc('x', {
        listingId: 'x',
        title: 'X',
        price: 3,
        imageUrl: 'https://example.com/x.jpg',
        savedAt: 42,
        deleted: false,
      }),
    ).toEqual({
      id: 'x',
      title: 'X',
      price: 3,
      imageUrl: 'https://example.com/x.jpg',
      savedAt: 42,
    });

    expect(
      mapSavedListingRemoteDoc('x', {
        listingId: 'x',
        deleted: true,
        deletedAt: 99,
      }),
    ).toBeNull();

    expect(
      mapSavedListingRemoteTombstone('x', {
        listingId: 'x',
        deleted: true,
        deletedAt: 99,
      }),
    ).toEqual({ id: 'x', deletedAt: 99 });

    expect(
      mapSavedListingRemoteTombstone('x', {
        listingId: 'x',
        title: 'still active',
        savedAt: 1,
      }),
    ).toBeNull();

    expect(mapSavedListingRemoteDoc('', { title: 'nope' })).toBeNull();
  });
});
