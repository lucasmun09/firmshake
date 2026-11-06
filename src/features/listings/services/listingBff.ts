import {
  createListingViaBff,
  markListingSoldViaBff,
  removeListingViaBff,
  updateListingViaBff,
} from '@/common/services/api';
import type { Listing } from '@/types';

export type CreateListingInput = Omit<
  Listing,
  'id' | 'status' | 'createdAt' | 'imageUrl' | 'titleLower' | 'primaryCategoryId' | 'categoryIds'
> & {
  primaryCategoryId?: string;
  categoryIds?: string[];
};

export type UpdateListingInput = Omit<
  Listing,
  | 'id'
  | 'status'
  | 'createdAt'
  | 'imageUrl'
  | 'sellerId'
  | 'sellerName'
  | 'titleLower'
  | 'primaryCategoryId'
  | 'categoryIds'
  | 'location'
> & {
  primaryCategoryId?: string;
  categoryIds?: string[];
  location?: Listing['location'];
};

/** Create a listing through firmshake-api (feed + search sync server-side). */
export async function createListing(input: CreateListingInput): Promise<Listing> {
  return createListingViaBff(input);
}

/** Update a listing through firmshake-api. */
export async function updateListing(
  listingId: string,
  input: UpdateListingInput,
): Promise<Listing> {
  return updateListingViaBff(listingId, input);
}

/** Remove a listing through firmshake-api (seller or moderator). */
export async function removeListing(listingId: string): Promise<Listing> {
  return removeListingViaBff(listingId);
}

/** Mark a listing sold through firmshake-api (seller only). */
export async function markListingSold(listingId: string): Promise<Listing> {
  return markListingSoldViaBff(listingId);
}
