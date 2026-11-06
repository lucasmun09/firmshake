import { getApiBaseUrl } from '@/utils/apiBaseUrl';

export class PlatformBanError extends Error {
  constructor(message = 'This account has been banned from FirmShake.') {
    super(message);
    this.name = 'PlatformBanError';
  }
}

export async function assertNotPlatformBanned(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return;
  }

  const base = getApiBaseUrl();
  const url = `${base}/api/controlpanel/check-ban`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalized }),
    });

    if (!response.ok) {
      return;
    }

    const body = (await response.json()) as { banned?: boolean; reason?: string };
    if (body.banned) {
      const reason = body.reason?.trim();
      throw new PlatformBanError(
        reason ? `This account has been banned: ${reason}` : undefined,
      );
    }
  } catch (error) {
    if (error instanceof PlatformBanError) {
      throw error;
    }
    // Fail open when the API is unreachable so login is not blocked by outages.
  }
}
