import type { Community } from '@/types';

export const ALL_COMMUNITY_ID = 'all';

export const SEED_COMMUNITIES: Community[] = [
  {
    id: ALL_COMMUNITY_ID,
    name: 'All',
    type: 'system',
    description: 'Global marketplace — every listing tagged for all communities appears here.',
  },
];
