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
  it('maps remote docs and rejects empty ids', async () => {
    const { mapSavedListingRemoteDoc, canSyncSavedListingsRemote } = await import(
      '@/features/listings/services/savedListingsRemote'
    );

    expect(canSyncSavedListingsRemote('user-a')).toBe(true);
    expect(canSyncSavedListingsRemote('anonymous')).toBe(false);

    expect(
      mapSavedListingRemoteDoc('x', {
        listingId: 'x',
        title: 'X',
        price: 3,
        imageUrl: 'https://example.com/x.jpg',
        savedAt: 42,
      }),
    ).toEqual({
      id: 'x',
      title: 'X',
      price: 3,
      imageUrl: 'https://example.com/x.jpg',
      savedAt: 42,
    });
    expect(mapSavedListingRemoteDoc('', { title: 'nope' })).toBeNull();
  });
});
