import type { NotificationType } from '@/types';
import { getApiBaseUrl } from '@/utils/apiBaseUrl';
import { currentUser } from './auth';

export async function authHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {};
  const user = currentUser.value;
  if (user) {
    const token = await user.getIdToken();
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function uploadImage(file: File, communityIds: string[]): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('communityIds', JSON.stringify(communityIds));

  const response = await fetch(`${getApiBaseUrl()}/api/images`, {
    method: 'POST',
    headers: await authHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || 'Image upload failed. Is firmshake-api running?');
  }

  const data = (await response.json()) as { url: string };
  return data.url;
}

export async function postMeetupLocation(
  agreementId: string,
  lat: number,
  lng: number,
): Promise<{
  etaMinutes: number;
  progressPercent: number;
  otherParty: { etaMinutes?: number; progressPercent?: number };
}> {
  const response = await fetch(`${getApiBaseUrl()}/api/meetups/${agreementId}/location`, {
    method: 'POST',
    headers: {
      ...(await authHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ lat, lng }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Failed to update meetup location');
  }

  return response.json();
}

export async function sendPushNotification(input: {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  title: string;
  body: string;
  listingId?: string;
}): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/api/notifications/push`, {
    method: 'POST',
    headers: {
      ...(await authHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Failed to send push notification');
  }
}

export { getApiBaseUrl } from '@/utils/apiBaseUrl';
