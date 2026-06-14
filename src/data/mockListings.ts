import type { Listing } from '@/types';
import { ALL_COMMUNITY_ID } from './mockCommunities';

export const mockListings: Listing[] = [
  {
    id: '1',
    title: 'Mazda Miata Soft Top (1999)',
    description: 'Black soft top in good condition. Pick up near church parking lot.',
    price: 450,
    imageUrl: 'https://picsum.photos/seed/miata/400/300',
    sellerName: 'Alex R.',
    communityIds: [ALL_COMMUNITY_ID, 'miata-enthusiasts'],
  },
  {
    id: '2',
    title: 'Petzl Harness + Quickdraws',
    description: 'Lightly used climbing gear bundle. Great for gym and outdoor days.',
    price: 85,
    imageUrl: 'https://picsum.photos/seed/climb/400/300',
    sellerName: 'Jordan K.',
    communityIds: [ALL_COMMUNITY_ID, 'bay-area-climbers'],
  },
  {
    id: '3',
    title: 'Kids choir robes (set of 3)',
    description: 'Size 10-12. Free to a good home in the parish community.',
    price: 0,
    imageUrl: 'https://picsum.photos/seed/choir/400/300',
    sellerName: 'Maria S.',
    communityIds: ['st-marys-church'],
  },
  {
    id: '4',
    title: 'IKEA Kallax shelf — white',
    description: '4x4 unit. Must pick up. Firm on price with a binding meetup.',
    price: 60,
    imageUrl: 'https://picsum.photos/seed/shelf/400/300',
    sellerName: 'Chris T.',
    communityIds: [ALL_COMMUNITY_ID],
  },
];
