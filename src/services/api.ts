import { currentUser } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001';

async function authHeaders(): Promise<HeadersInit> {
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
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/images`, {
    method: 'POST',
    headers: await authHeaders(),
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Image upload failed');
  }

  const data = (await response.json()) as { url: string };
  return `${API_BASE_URL}${data.url}`;
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
