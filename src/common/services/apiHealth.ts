/**
 * BFF /health probe with cold-start retries.
 * Dual-stack payload parsing lives in apiHealthContract.ts.
 */
import { debugLog } from '@/common/debug/debugLog';
import { loggedFetch } from '@/common/debug/loggedFetch';
import {
  type ApiHealthPayload,
  hasDualStackHealthFields,
  parseApiHealthPayload,
} from '@/common/services/apiHealthContract';
import { getApiBaseUrl, isApiConfigured } from '@/utils/apiBaseUrl';

const API_HEALTH_ATTEMPT_TIMEOUT_MS = 8_000;
/** Pause between retries — helps Cloud Run cold starts without blocking UI forever. */
const API_HEALTH_RETRY_DELAYS_MS = [0, 2_000, 4_000];

async function probeApiHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_HEALTH_ATTEMPT_TIMEOUT_MS);

  try {
    const response = await loggedFetch(
      `${getApiBaseUrl()}/health`,
      { signal: controller.signal },
      {
        category: 'api',
        label: 'GET /health',
      },
    );
    return response.ok;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkApiHealth(): Promise<boolean> {
  if (!isApiConfigured()) {
    return false;
  }

  for (let attempt = 0; attempt < API_HEALTH_RETRY_DELAYS_MS.length; attempt++) {
    const delayMs = API_HEALTH_RETRY_DELAYS_MS[attempt];
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    try {
      if (await probeApiHealth()) {
        return true;
      }
    } catch {
      // Retry on network errors, timeouts, and aborts (e.g. cold start).
    }
  }

  return false;
}

/**
 * Fetch and parse dual-stack /health JSON. Returns null when API is down or
 * the body is not JSON. Legacy payloads without stack fields still parse.
 */
export async function fetchApiHealthPayload(): Promise<ApiHealthPayload | null> {
  if (!isApiConfigured()) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_HEALTH_ATTEMPT_TIMEOUT_MS);
  try {
    const response = await loggedFetch(
      `${getApiBaseUrl()}/health`,
      { signal: controller.signal },
      {
        category: 'api',
        label: 'GET /health (payload)',
      },
    );
    if (!response.ok) {
      return null;
    }
    const raw: unknown = await response.json().catch(() => null);
    const payload = parseApiHealthPayload(raw);
    if (payload && hasDualStackHealthFields(payload)) {
      debugLog.debug('api', 'health.payload.dualStack', {
        stack: payload.stack,
        firebaseProjectId: payload.firebaseProjectId,
        paymentsEnabled: payload.paymentsEnabled,
      });
    }
    return payload;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchApiReadyPayload(): Promise<ApiHealthPayload | null> {
  if (!isApiConfigured()) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_HEALTH_ATTEMPT_TIMEOUT_MS);
  try {
    const response = await loggedFetch(
      `${getApiBaseUrl()}/ready`,
      { signal: controller.signal },
      {
        category: 'api',
        label: 'GET /ready',
      },
    );
    if (!response.ok) {
      return null;
    }
    return parseApiHealthPayload(await response.json().catch(() => null));
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
