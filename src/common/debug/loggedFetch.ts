import { debugLog, serializeError } from '@/common/debug/debugLog';

function summarizeRequestBody(body: BodyInit | null | undefined): unknown {
  if (!body) {
    return undefined;
  }

  if (body instanceof FormData) {
    const summary: Record<string, unknown>[] = [];
    body.forEach((value, key) => {
      if (value instanceof File) {
        summary.push({ key, fileName: value.name, size: value.size, type: value.type });
      } else {
        summary.push({ key, value: String(value).slice(0, 500) });
      }
    });
    return { formData: summary };
  }

  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return body.length > 500 ? `${body.slice(0, 500)}…` : body;
    }
  }

  return '[unsupported body type]';
}

async function summarizeResponseBody(response: Response, url: string): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';

  if (url.includes('/api/images') || contentType.startsWith('image/')) {
    return { omitted: 'image/binary response' };
  }

  const clone = response.clone();

  if (contentType.includes('application/json')) {
    try {
      return await clone.json();
    } catch {
      return { parseError: 'invalid JSON' };
    }
  }

  try {
    const text = await clone.text();
    if (!text) {
      return undefined;
    }

    return text.length > 4000 ? `${text.slice(0, 4000)}…[truncated]` : text;
  } catch {
    return { readError: true };
  }
}

export async function loggedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  meta?: { category?: string; label?: string },
): Promise<Response> {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
  const method = init?.method ?? 'GET';
  const category = meta?.category ?? 'api';
  const label = meta?.label ?? `${method} ${url}`;

  debugLog.info(category, `→ ${label}`, {
    request: summarizeRequestBody(init?.body ?? null),
  });

  const started = performance.now();

  try {
    const response = await fetch(input, init);
    const durationMs = Math.round(performance.now() - started);
    const responseBody = await summarizeResponseBody(response, url);

    const logData = {
      status: response.status,
      ok: response.ok,
      durationMs,
      response: responseBody,
    };

    if (response.ok) {
      debugLog.info(category, `← ${response.status} ${label}`, logData);
    } else {
      debugLog.warn(category, `← ${response.status} ${label}`, logData);
    }

    return response;
  } catch (error) {
    debugLog.error(category, `✕ ${label}`, {
      durationMs: Math.round(performance.now() - started),
      error: serializeError(error),
    });
    throw error;
  }
}
