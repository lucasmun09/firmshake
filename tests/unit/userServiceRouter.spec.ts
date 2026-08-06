import { beforeEach, describe, expect, it, vi } from 'vitest';

const useBffUsers = vi.fn(() => false);

vi.mock('@/common/config/featureFlags', () => ({
  useBffUsers: () => useBffUsers(),
}));

vi.mock('@/common/services/userBff', () => ({
  completeUserProfileNamesViaBff: vi.fn(),
  updateUserPhotoUrlViaBff: vi.fn(),
  joinCommunityViaBffApi: vi.fn(),
  blockUserViaBff: vi.fn(),
  unblockUserViaBff: vi.fn(),
}));

vi.mock('@/common/services/userFirestoreWrites', () => ({
  completeUserProfileNames: vi.fn(),
  updateUserPhotoUrl: vi.fn(),
  joinCommunity: vi.fn(),
}));

vi.mock('@/common/services/blockFirestoreWrites', () => ({
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
}));

describe('userServiceRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBffUsers.mockReturnValue(false);
  });

  it('routes profile name update to Firestore when BFF flag is off', async () => {
    const firestore = await import('@/common/services/userFirestoreWrites');
    const { routeCompleteUserProfileNames } = await import('@/common/services/userServiceRouter');

    await routeCompleteUserProfileNames('user-1', 'Jane', 'Doe');

    expect(firestore.completeUserProfileNames).toHaveBeenCalledWith('user-1', 'Jane', 'Doe');
  });

  it('routes profile name update to BFF when flag is on', async () => {
    useBffUsers.mockReturnValue(true);
    const bff = await import('@/common/services/userBff');
    const { routeCompleteUserProfileNames } = await import('@/common/services/userServiceRouter');

    await routeCompleteUserProfileNames('user-1', 'Jane', 'Doe');

    expect(bff.completeUserProfileNamesViaBff).toHaveBeenCalledWith('Jane', 'Doe');
  });
});

describe('blockServiceRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBffUsers.mockReturnValue(false);
  });

  it('routes block to Firestore when BFF flag is off', async () => {
    const firestore = await import('@/common/services/blockFirestoreWrites');
    const { routeBlockUser } = await import('@/common/services/blockServiceRouter');

    await routeBlockUser('blocker-1', 'blocked-1');

    expect(firestore.blockUser).toHaveBeenCalledWith('blocker-1', 'blocked-1');
  });

  it('routes block to BFF when flag is on', async () => {
    useBffUsers.mockReturnValue(true);
    const bff = await import('@/common/services/userBff');
    const { routeBlockUser } = await import('@/common/services/blockServiceRouter');

    await routeBlockUser('blocker-1', 'blocked-1');

    expect(bff.blockUserViaBff).toHaveBeenCalledWith('blocked-1');
  });
});
