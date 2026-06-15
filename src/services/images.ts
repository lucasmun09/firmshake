import { getApiBaseUrl } from '@/utils/apiBaseUrl';
import { authHeaders } from './api';

const blobCache = new Map<string, string>();

const PROTECTED_IMAGE_PATTERN = /\/api\/images\/[a-f0-9]{32}$/;

export function isProtectedApiImageUrl(url: string): boolean {
  return PROTECTED_IMAGE_PATTERN.test(url);
}

export function clearAuthenticatedImageCache(): void {
  for (const objectUrl of blobCache.values()) {
    URL.revokeObjectURL(objectUrl);
  }
  blobCache.clear();
}

export async function resolveAuthenticatedImageUrl(url: string): Promise<string> {
  if (!url || !isProtectedApiImageUrl(url)) {
    return url;
  }

  const cached = blobCache.get(url);
  if (cached) {
    return cached;
  }

  const fullUrl = url.startsWith('http') ? url : `${getApiBaseUrl()}${url}`;
  const response = await fetch(fullUrl, {
    headers: await authHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to load image');
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  blobCache.set(url, objectUrl);
  return objectUrl;
}
