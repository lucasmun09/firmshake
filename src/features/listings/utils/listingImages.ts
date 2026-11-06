import { normalizeImageUrl } from '@/utils/apiBaseUrl';

export function normalizeListingImageUrls(data: Record<string, unknown>): string[] {
  if (Array.isArray(data.imageUrls)) {
    const urls = data.imageUrls
      .map((entry) => normalizeImageUrl(String(entry ?? '')))
      .filter(Boolean);
    if (urls.length > 0) {
      return urls;
    }
  }

  const legacy = normalizeImageUrl(String(data.imageUrl ?? ''));
  return legacy ? [legacy] : [];
}

export function primaryListingImageUrl(imageUrls: string[]): string {
  return imageUrls[0] ?? '';
}
