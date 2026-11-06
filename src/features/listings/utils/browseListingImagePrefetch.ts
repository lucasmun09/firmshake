import { prefetchListingPrimaryThumbnails } from '@/common/services/images';

/** Fire-and-forget prefetch of browse listing primary images (thumbnails). */
export function scheduleBrowseListingImagePrefetch(
  listings: Array<{ imageUrl?: string }>,
): void {
  const urls = listings.map((listing) => listing.imageUrl).filter(Boolean) as string[];
  if (urls.length === 0) {
    return;
  }

  void prefetchListingPrimaryThumbnails(urls);
}
