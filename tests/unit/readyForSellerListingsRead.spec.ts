import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureFirestoreAuth = vi.fn(async () => undefined);
const authStateReady = vi.fn(async () => undefined);

vi.mock('@/common/services/firestoreAuth', async () => {
  const actual = await vi.importActual<typeof import('@/common/services/firestoreAuth')>(
    '@/common/services/firestoreAuth',
  );
  return {
    ...actual,
    ensureFirestoreAuth,
  };
});

vi.mock('@/common/services/firebase', () => ({
  db: {},
  isFirebaseConfigured: true,
  auth: {
    get currentUser() {
      return (globalThis as { __fsAuthUser?: { uid: string } | null }).__fsAuthUser ?? null;
    },
    authStateReady,
  },
}));

vi.mock('@/features/listings/services/listingServiceRouter', () => ({
  routeCreateListing: vi.fn(),
  routeMarkListingSold: vi.fn(),
  routeRemoveListing: vi.fn(),
  routeUpdateListing: vi.fn(),
  shouldRouteListingsViaBff: vi.fn(() => false),
}));

vi.mock('@/features/listings/services/listingFeed', () => ({
  fetchBrowsePage: vi.fn(),
}));

describe('readyForSellerListingsRead', () => {
  beforeEach(() => {
    ensureFirestoreAuth.mockClear();
    authStateReady.mockClear();
    (globalThis as { __fsAuthUser?: { uid: string } | null }).__fsAuthUser = null;
  });

  it('skips ensureFirestoreAuth for guests and waits for authStateReady', async () => {
    const { readyForSellerListingsRead } = await import('@/features/listings/services/listings');
    await expect(readyForSellerListingsRead()).resolves.toBe('guest');
    expect(ensureFirestoreAuth).not.toHaveBeenCalled();
    expect(authStateReady).toHaveBeenCalled();
  });

  it('uses ensureFirestoreAuth when signed in', async () => {
    (globalThis as { __fsAuthUser?: { uid: string } | null }).__fsAuthUser = { uid: 'u1' };
    const { readyForSellerListingsRead } = await import('@/features/listings/services/listings');
    await expect(readyForSellerListingsRead()).resolves.toBe('signed-in');
    expect(ensureFirestoreAuth).toHaveBeenCalled();
  });
});
