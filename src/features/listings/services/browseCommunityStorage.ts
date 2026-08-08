import { ALL_COMMUNITY_ID } from '@/features/communities/data/seedCommunities';

const STORAGE_KEY = 'firmshake.browseCommunityId';

export function loadPersistedBrowseCommunity(): string {
  if (typeof sessionStorage === 'undefined') {
    return ALL_COMMUNITY_ID;
  }

  const stored = sessionStorage.getItem(STORAGE_KEY)?.trim();
  return stored || ALL_COMMUNITY_ID;
}

export function persistBrowseCommunity(communityId: string): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  sessionStorage.setItem(STORAGE_KEY, communityId || ALL_COMMUNITY_ID);
}
