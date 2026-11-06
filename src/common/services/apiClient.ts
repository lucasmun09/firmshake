/**
 * Shared BFF client helpers (auth header + error parse).
 * Kept separate from domain API modules for parallel-agent edits.
 */
import { getDedupedIdToken } from '@/common/services/firestoreAuth';
import { currentUser } from '@/features/auth/services/auth';

export async function authHeaders(forceRefresh = false): Promise<HeadersInit> {
  const headers: HeadersInit = {};
  const user = currentUser.value;
  if (user) {
    const token = await getDedupedIdToken(user, forceRefresh);
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function parseApiError(body: string, fallback: string): string {
  try {
    const data = JSON.parse(body) as { error?: string };
    if (data.error) {
      return data.error;
    }
  } catch {
    // Use raw body below.
  }

  return body.trim() || fallback;
}
