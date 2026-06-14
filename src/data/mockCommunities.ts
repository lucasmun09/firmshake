import type { Community } from '@/types';

export const ALL_COMMUNITY_ID = 'all';

export const mockCommunities: Community[] = [
  {
    id: ALL_COMMUNITY_ID,
    name: 'All',
    type: 'system',
    description: 'Global marketplace — every listing tagged for all communities appears here.',
  },
  {
    id: 'st-marys-church',
    name: "St. Mary's Church",
    type: 'admin',
    description: 'Admin-curated community for parish members.',
  },
  {
    id: 'bay-area-climbers',
    name: 'Bay Area Climbers',
    type: 'admin',
    description: 'Admin-curated climbing group marketplace.',
  },
  {
    id: 'miata-enthusiasts',
    name: 'Miata Enthusiasts',
    type: 'user',
    description: 'User-created club for Mazda Miata owners.',
  },
];
