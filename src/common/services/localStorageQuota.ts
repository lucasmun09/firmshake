/**
 * localStorage quota helpers — evict non-essential caches so Firebase auth
 * persistence and other critical keys can write successfully.
 */

const BROWSE_LOCAL_PREFIX = 'firmshake-browse-local:';
const DEBUG_LOGS_KEY = 'firmshake.debugLogs';

/** Keys that must never be removed by eviction (Firebase auth, small auth flows). */
const PROTECTED_KEY_PREFIXES = ['firebase:'];
const PROTECTED_KEYS = new Set([
  'firmshake.emailForPasswordReset',
  'firmshake.passwordResetPending',
  'firmshake:googleRedirectPending',
  'firmshake:sessionExtendedAt',
]);

export function isQuotaExceededError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return true;
  }

  if (typeof error === 'object' && error !== null && 'name' in error) {
    const name = (error as { name: unknown }).name;
    if (name === 'QuotaExceededError') {
      return true;
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  return /quota|QuotaExceeded|setItem.*exceeded/i.test(message);
}

export function isProtectedLocalStorageKey(key: string): boolean {
  if (PROTECTED_KEYS.has(key)) {
    return true;
  }

  return PROTECTED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function estimateLocalStorageUsage(): number {
  if (typeof localStorage === 'undefined') {
    return 0;
  }

  let total = 0;
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) {
      continue;
    }

    const value = localStorage.getItem(key);
    total += key.length + (value?.length ?? 0);
  }

  return total;
}

export function estimatePrefixUsage(prefix: string): number {
  if (typeof localStorage === 'undefined') {
    return 0;
  }

  let total = 0;
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) {
      continue;
    }

    const value = localStorage.getItem(key);
    total += key.length + (value?.length ?? 0);
  }

  return total;
}

interface BrowseCacheEntryMeta {
  storageKey: string;
  cachedAt: number;
  size: number;
}

function readBrowseCacheCachedAt(storageKey: string): number {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return 0;
    }

    const parsed = JSON.parse(raw) as { data?: { cachedAt?: number } };
    return typeof parsed.data?.cachedAt === 'number' ? parsed.data.cachedAt : 0;
  } catch {
    return 0;
  }
}

function listBrowseCacheEntries(): BrowseCacheEntryMeta[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  const entries: BrowseCacheEntryMeta[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const storageKey = localStorage.key(index);
    if (!storageKey?.startsWith(BROWSE_LOCAL_PREFIX)) {
      continue;
    }

    if (storageKey.endsWith('owner-uid')) {
      continue;
    }

    const value = localStorage.getItem(storageKey);
    entries.push({
      storageKey,
      cachedAt: readBrowseCacheCachedAt(storageKey),
      size: storageKey.length + (value?.length ?? 0),
    });
  }

  return entries.sort((left, right) => left.cachedAt - right.cachedAt);
}

export interface EvictBrowseCacheOptions {
  maxEntries?: number;
  maxBytes?: number;
  targetFreeBytes?: number;
}

export function evictBrowseLocalCacheEntries(options: EvictBrowseCacheOptions = {}): number {
  if (typeof localStorage === 'undefined') {
    return 0;
  }

  const entries = listBrowseCacheEntries();
  if (entries.length === 0) {
    return 0;
  }

  let totalBytes = entries.reduce((sum, entry) => sum + entry.size, 0);
  let freedBytes = 0;
  const maxEntries = options.maxEntries;
  const maxBytes = options.maxBytes;
  const targetFreeBytes = options.targetFreeBytes ?? 0;
  let removed = 0;

  for (const entry of entries) {
    const overEntryLimit = maxEntries !== undefined && entries.length - removed > maxEntries;
    const overByteLimit = maxBytes !== undefined && totalBytes > maxBytes;
    const needMoreSpace = freedBytes < targetFreeBytes;

    if (!overEntryLimit && !overByteLimit && !needMoreSpace) {
      break;
    }

    localStorage.removeItem(entry.storageKey);
    totalBytes -= entry.size;
    freedBytes += entry.size;
    removed += 1;
  }

  if (removed > 0) {
    // Callers may log eviction stats when needed.
  }

  return freedBytes;
}

function trimDebugLogs(): number {
  if (typeof localStorage === 'undefined') {
    return 0;
  }

  const before = localStorage.getItem(DEBUG_LOGS_KEY)?.length ?? 0;
  if (before === 0) {
    return 0;
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(DEBUG_LOGS_KEY) ?? '[]') as unknown[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return 0;
    }

    const trimmed = parsed.slice(Math.ceil(parsed.length / 2));
    localStorage.setItem(DEBUG_LOGS_KEY, JSON.stringify(trimmed));
    const after = localStorage.getItem(DEBUG_LOGS_KEY)?.length ?? 0;
    const freed = Math.max(0, before - after);

    if (freed > 0) {
      // Trimmed for quota — details available via estimateLocalStorageUsage().
    }

    return freed;
  } catch {
    localStorage.removeItem(DEBUG_LOGS_KEY);
    return before;
  }
}

/**
 * Frees localStorage space for auth-critical writes (Firebase persistence, MFA).
 * Evicts browse caches first, then trims debug logs. Never touches firebase: keys.
 */
export function freeLocalStorageForAuth(): number {
  if (typeof localStorage === 'undefined') {
    return 0;
  }

  const before = estimateLocalStorageUsage();
  evictBrowseLocalCacheEntries({ targetFreeBytes: 256 * 1024 });
  trimDebugLogs();
  evictBrowseLocalCacheEntries({ maxEntries: 8 });
  const after = estimateLocalStorageUsage();

  const freed = Math.max(0, before - after);
  return freed;
}

export interface SafeSetItemOptions {
  /** When true, runs {@link freeLocalStorageForAuth} before the first attempt. */
  preferAuthSpace?: boolean;
}

/**
 * Writes to localStorage with quota recovery: evicts non-essential caches and retries once.
 */
export function safeLocalStorageSetItem(
  key: string,
  value: string,
  options: SafeSetItemOptions = {},
): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }

  const attempt = (): boolean => {
    try {
      localStorage.setItem(key, value);
      return localStorage.getItem(key) === value;
    } catch (error) {
      if (!isQuotaExceededError(error)) {
        return false;
      }
      return false;
    }
  };

  if (options.preferAuthSpace) {
    freeLocalStorageForAuth();
  }

  if (attempt()) {
    return true;
  }

  if (!isProtectedLocalStorageKey(key)) {
    evictBrowseLocalCacheEntries({ targetFreeBytes: 512 * 1024, maxEntries: 5 });
    trimDebugLogs();
  } else {
    freeLocalStorageForAuth();
  }

  return attempt();
}
