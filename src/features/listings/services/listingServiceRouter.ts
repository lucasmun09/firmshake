/**
 * Routes listing mutations to Firestore or firmshake-api based on feature flags.
 */
import { useBffListings } from '@/common/config/featureFlags';
import type { Listing, UserProfile } from '@/types';
import { canRemoveListing } from '@/utils/moderation';

import * as listingBff from './listingBff';
import type { CreateListingInput, UpdateListingInput } from './listingBff';
import * as listingFirestoreWrites from './listingFirestoreWrites';
import { getListingById } from './listings';

export type { CreateListingInput, UpdateListingInput } from './listingBff';

export function shouldRouteListingsViaBff(): boolean {
  return useBffListings();
}

export async function routeCreateListing(input: CreateListingInput): Promise<Listing> {
  if (useBffListings()) {
    return listingBff.createListing(input);
  }
  return listingFirestoreWrites.createListing(input);
}

export async function routeUpdateListing(
  listingId: string,
  input: UpdateListingInput,
): Promise<Listing> {
  const existing = await getListingById(listingId);
  if (!existing) {
    throw new Error('Listing not found');
  }

  const imageUrls = input.imageUrls.filter(Boolean);
  const primaryCategoryId = input.primaryCategoryId || existing.primaryCategoryId;
  const categoryIds =
    input.categoryIds && input.categoryIds.length > 0 ? input.categoryIds : [primaryCategoryId];

  const merged: UpdateListingInput = {
    ...input,
    imageUrls,
    communityIds: input.communityIds ?? existing.communityIds,
    primaryCategoryId,
    categoryIds,
    location: input.location ?? existing.location,
  };

  if (useBffListings()) {
    return listingBff.updateListing(listingId, merged);
  }
  return listingFirestoreWrites.updateListing(listingId, merged, existing);
}

export async function routeRemoveListing(
  listingId: string,
  actor: UserProfile,
): Promise<Listing> {
  const existing = await getListingById(listingId);
  if (!existing) {
    throw new Error('Listing not found');
  }

  if (existing.status !== 'active') {
    throw new Error('This listing is no longer active');
  }

  if (!canRemoveListing(actor, existing)) {
    throw new Error('You do not have permission to remove this listing');
  }

  if (useBffListings()) {
    return listingBff.removeListing(listingId);
  }
  return listingFirestoreWrites.removeListing(listingId, actor, existing);
}
