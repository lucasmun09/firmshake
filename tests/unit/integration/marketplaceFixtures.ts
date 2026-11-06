import { vi } from 'vitest';

import type { SavedListingEntry } from '@/features/listings/services/savedListings';
import type { Listing, ListingSummary, Message, MessageThread } from '@/types';

export const BUYER_ID = 'buyer-1';
export const SELLER_ID = 'seller-1';
export const LISTING_ID = 'listing-bike-1';

export function makeFullListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: LISTING_ID,
    title: 'Mountain Bike',
    titleLower: 'mountain bike',
    description: 'Light trail bike with recent tune-up. Pickup only.',
    price: 250,
    imageUrl: 'https://example.com/bike.jpg',
    imageUrls: ['https://example.com/bike.jpg', 'https://example.com/bike-2.jpg'],
    sellerId: SELLER_ID,
    sellerName: 'Sam Seller',
    communityIds: ['all', 'arlington'],
    primaryCategoryId: 'sports',
    categoryIds: ['sports'],
    status: 'active',
    createdAt: new Date('2026-01-15T12:00:00Z'),
    location: { lat: 38.88, lng: -77.1, city: 'Arlington', region: 'VA' },
    ...overrides,
  };
}

export function makeSummary(overrides: Partial<ListingSummary> = {}): ListingSummary {
  const listing = makeFullListing();
  return {
    id: listing.id,
    title: listing.title,
    price: listing.price,
    imageUrl: listing.imageUrl,
    status: listing.status,
    sellerId: listing.sellerId,
    communityIds: listing.communityIds,
    primaryCategoryId: listing.primaryCategoryId,
    location: listing.location,
    createdAt: listing.createdAt,
    ...overrides,
  };
}

export function makeSavedEntry(
  overrides: Partial<SavedListingEntry> = {},
): SavedListingEntry {
  return {
    id: LISTING_ID,
    title: 'Mountain Bike',
    price: 250,
    imageUrl: 'https://example.com/bike.jpg',
    savedAt: 1_700_000_000_000,
    ...overrides,
  };
}

export function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    listingId: LISTING_ID,
    senderId: BUYER_ID,
    senderName: 'Buyer Bob',
    text: 'Is this still available?',
    recipientId: SELLER_ID,
    createdAt: new Date('2026-01-16T10:00:00Z'),
    ...overrides,
  };
}

export function makeThread(overrides: Partial<MessageThread> = {}): MessageThread {
  return {
    id: LISTING_ID,
    listingId: LISTING_ID,
    listingTitle: 'Mountain Bike',
    listingImageUrl: 'https://example.com/bike.jpg',
    listingStatus: 'active',
    sellerId: SELLER_ID,
    sellerName: 'Sam Seller',
    lastMessageText: 'Is this still available?',
    lastMessageSenderId: BUYER_ID,
    lastMessageSenderName: 'Buyer Bob',
    lastMessageAt: new Date('2026-01-16T10:00:00Z'),
    ...overrides,
  };
}

export function stubLocalStorage() {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
  });
  return storage;
}
