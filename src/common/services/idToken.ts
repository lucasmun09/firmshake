import type { User } from 'firebase/auth';

const ID_TOKEN_TIMEOUT_MS = 2000;
const ID_TOKEN_FORCE_REFRESH_COOLDOWN_MS = 60_000;

let inFlightIdToken: Promise<string> | null = null;
let inFlightIdTokenKey: string | null = null;
let lastIdTokenRefreshAt = 0;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export async function getDedupedIdToken(user: User, forceRefresh = false): Promise<string> {
  const key = `${user.uid}:${forceRefresh}`;
  if (inFlightIdToken && inFlightIdTokenKey === key) {
    return inFlightIdToken;
  }

  if (
    !forceRefresh
    && Date.now() - lastIdTokenRefreshAt < ID_TOKEN_FORCE_REFRESH_COOLDOWN_MS
  ) {
    return user.getIdToken(false);
  }

  inFlightIdTokenKey = key;
  inFlightIdToken = withTimeout(
    user.getIdToken(forceRefresh),
    ID_TOKEN_TIMEOUT_MS,
    'getIdToken',
  ).then((token) => {
    lastIdTokenRefreshAt = Date.now();
    return token;
  }).finally(() => {
    if (inFlightIdTokenKey === key) {
      inFlightIdToken = null;
      inFlightIdTokenKey = null;
    }
  });

  return inFlightIdToken;
}

export function clearIdTokenCache(): void {
  lastIdTokenRefreshAt = 0;
}
