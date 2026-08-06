import { ALL_COMMUNITY_ID } from '@/features/communities/data/seedCommunities';
import { uploadImage } from '@/common/services/api';
import type { ListingPhotoItem } from '@/features/listings/types/listingPhotos';
import { MIN_LISTING_PHOTOS } from '@/features/listings/constants/listingPhotos';

export async function resolveListingImageUrls(
  photos: ListingPhotoItem[],
  communityIds: string[],
): Promise<string[]> {
  const uploadCommunityIds = communityIds.includes(ALL_COMMUNITY_ID)
    ? communityIds
    : [...communityIds, ALL_COMMUNITY_ID];
  const urls: string[] = [];

  for (const photo of photos) {
    if (photo.existingUrl) {
      urls.push(photo.existingUrl);
      continue;
    }

    if (photo.file) {
      urls.push(await uploadImage(photo.file, uploadCommunityIds));
    }
  }

  return urls;
}

export function validateListingPhotos(photos: ListingPhotoItem[]): void {
  if (photos.length < MIN_LISTING_PHOTOS) {
    throw new Error(`Add at least ${MIN_LISTING_PHOTOS} photo before posting.`);
  }
}

export function photosFromListing(imageUrls: string[]): ListingPhotoItem[] {
  return imageUrls.map((existingUrl, index) => ({
    key: `existing-${index}-${existingUrl}`,
    previewUrl: existingUrl,
    existingUrl,
  }));
}
