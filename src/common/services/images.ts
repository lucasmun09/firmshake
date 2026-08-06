import { getApiBaseUrl } from '@/utils/apiBaseUrl';
import { authHeaders } from '@/common/services/api';
import { currentUser } from '@/features/auth/services/auth';
import {
  clearPersistentImageCache,
  getPersistentImageBlob,
  setPersistentImageBlob,
} from '@/common/services/persistentImageCache';

const memoryBlobUrls = new Map<string, string>();

const PROTECTED_IMAGE_PATTERN = /\/api\/images\/[a-f0-9]{32}$/;

export function isProtectedApiImageUrl(url: string): boolean {
  return PROTECTED_IMAGE_PATTERN.test(url);
}

function rememberBlobUrl(url: string, blob: Blob): string {
  const existing = memoryBlobUrls.get(url);
  if (existing) {
    return existing;
  }

  const objectUrl = URL.createObjectURL(blob);
  memoryBlobUrls.set(url, objectUrl);
  return objectUrl;
}

export function clearAuthenticatedImageCache(): void {
  for (const objectUrl of memoryBlobUrls.values()) {
    URL.revokeObjectURL(objectUrl);
  }
  memoryBlobUrls.clear();
  void clearPersistentImageCache();
}

export async function resolveAuthenticatedImageUrl(url: string): Promise<string> {
  if (!url || !isProtectedApiImageUrl(url)) {
    return url;
  }

  const memoryCached = memoryBlobUrls.get(url);
  if (memoryCached) {
    return memoryCached;
  }

  const persistentBlob = await getPersistentImageBlob(url);
  if (persistentBlob) {
    return rememberBlobUrl(url, persistentBlob);
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
  return rememberBlobUrl(url, blob);
}

export async function prefetchAuthenticatedImages(urls: string[]): Promise<void> {
  await Promise.all(
    urls.filter(Boolean).map((url) =>
      resolveAuthenticatedImageUrl(url).catch(() => undefined),
    ),
  );
}
