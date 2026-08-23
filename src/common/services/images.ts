import { getApiBaseUrl } from '@/utils/apiBaseUrl';
import { authHeaders } from '@/common/services/api';
import { currentUser } from '@/features/auth/services/auth';
import {
  clearPersistentImageCache,
  getPersistentImageBlob,
  setPersistentImageBlob,
} from '@/common/services/persistentImageCache';
import {
  createThumbnailBlob,
  thumbnailCacheKey,
} from '@/common/utils/thumbnailImage';

const memoryBlobUrls = new Map<string, string>();

const PROTECTED_IMAGE_PATTERN = /\/api\/images\/[a-f0-9]{32}$/;

export function isProtectedApiImageUrl(url: string): boolean {
  return PROTECTED_IMAGE_PATTERN.test(url);
}

function rememberBlobUrl(cacheKey: string, blob: Blob): string {
  const existing = memoryBlobUrls.get(cacheKey);
  if (existing) {
    return existing;
  }

  const objectUrl = URL.createObjectURL(blob);
  memoryBlobUrls.set(cacheKey, objectUrl);
  return objectUrl;
}

export function clearAuthenticatedImageCache(): void {
  for (const objectUrl of memoryBlobUrls.values()) {
    URL.revokeObjectURL(objectUrl);
  }
  memoryBlobUrls.clear();
  void clearPersistentImageCache();
}

async function fetchProtectedImageBlob(url: string): Promise<Blob> {
  const persistentBlob = await getPersistentImageBlob(url);
  if (persistentBlob) {
    return persistentBlob;
  }

  const fullUrl = url.startsWith('http') ? url : `${getApiBaseUrl()}${url}`;
  const headers: HeadersInit = {};
  const user = currentUser.value;
  if (user) {
    Object.assign(headers, await authHeaders());
  }

  const response = await fetch(fullUrl, { headers });

  if (!response.ok) {
    throw new Error('Failed to load image');
  }

  const blob = await response.blob();
  void setPersistentImageBlob(url, blob);
  return blob;
}

async function resolveCachedBlobUrl(cacheKey: string): Promise<string | null> {
  const memoryCached = memoryBlobUrls.get(cacheKey);
  if (memoryCached) {
    return memoryCached;
  }

  const persistentBlob = await getPersistentImageBlob(cacheKey);
  if (persistentBlob) {
    return rememberBlobUrl(cacheKey, persistentBlob);
  }

  return null;
}

export async function resolveAuthenticatedImageUrl(url: string): Promise<string> {
  if (!url || !isProtectedApiImageUrl(url)) {
    return url;
  }

  const cached = await resolveCachedBlobUrl(url);
  if (cached) {
    return cached;
  }

  const blob = await fetchProtectedImageBlob(url);
  return rememberBlobUrl(url, blob);
}

export async function resolveAuthenticatedThumbnailUrl(url: string): Promise<string> {
  if (!url || !isProtectedApiImageUrl(url)) {
    return url;
  }

  const thumbKey = thumbnailCacheKey(url);
  const cachedThumb = await resolveCachedBlobUrl(thumbKey);
  if (cachedThumb) {
    return cachedThumb;
  }

  const sourceBlob = await fetchProtectedImageBlob(url);
  const thumbnailBlob = await createThumbnailBlob(sourceBlob);
  void setPersistentImageBlob(thumbKey, thumbnailBlob);
  return rememberBlobUrl(thumbKey, thumbnailBlob);
}

export async function prefetchAuthenticatedImages(urls: string[]): Promise<void> {
  await Promise.all(
    urls.filter(Boolean).map((url) =>
      resolveAuthenticatedImageUrl(url).catch(() => undefined),
    ),
  );
}

/** Prefetch lower-resolution primary listing images for fast browse-card paint. */
export async function prefetchListingPrimaryThumbnails(urls: string[]): Promise<void> {
  const unique = [...new Set(urls.filter(Boolean))];
  await Promise.all(
    unique.map((url) => resolveAuthenticatedThumbnailUrl(url).catch(() => undefined)),
  );
}
