export const RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000;

const STORAGE_PREFIX = 'firmshake-cache:';
export const CACHE_OWNER_UID_KEY = `${STORAGE_PREFIX}owner-uid`;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memory = new Map<string, CacheEntry<unknown>>();

export function buildCacheKey(
  namespace: string,
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const parts = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`);

  return parts.length > 0 ? `${namespace}:${parts.join('&')}` : namespace;
}

export function buildUserCacheKey(
  uid: string,
  namespace: string,
  params: Record<string, string | number | boolean | undefined | null> = {},
): string {
  return buildCacheKey(namespace, { uid, ...params });
}

function readStorageEntryRaw<T>(key: string): CacheEntry<T> | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (typeof parsed.expiresAt !== 'number' || parsed.data === undefined) {
      sessionStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function readStorageEntryFresh<T>(key: string): CacheEntry<T> | null {
  const entry = readStorageEntryRaw<T>(key);
  if (!entry || !isEntryFresh(entry)) {
    return null;
  }

  return entry;
}

function writeStorageEntry<T>(key: string, entry: CacheEntry<T>): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // Ignore quota errors.
  }
}

function removeStorageEntry(key: string): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  sessionStorage.removeItem(`${STORAGE_PREFIX}${key}`);
}

function isEntryFresh(entry: CacheEntry<unknown>): boolean {
  return entry.expiresAt > Date.now();
}

export function getCached<T>(key: string): T | null {
  const inMemory = memory.get(key) as CacheEntry<T> | undefined;
  if (inMemory) {
    if (!isEntryFresh(inMemory)) {
      memory.delete(key);
    } else {
      return inMemory.data;
    }
  }

  const stored = readStorageEntryFresh<T>(key);
  if (!stored) {
    return null;
  }

  memory.set(key, stored);
  return stored.data;
}

export function getStaleCached<T>(key: string): T | null {
  const inMemory = memory.get(key) as CacheEntry<T> | undefined;
  if (inMemory) {
    return inMemory.data;
  }

  const stored = readStorageEntryRaw<T>(key);
  if (!stored) {
    return null;
  }

  memory.set(key, stored);
  return stored.data;
}

export function isCacheFresh(key: string): boolean {
  const inMemory = memory.get(key);
  if (inMemory) {
    return isEntryFresh(inMemory);
  }

  const stored = readStorageEntryRaw(key);
  return stored ? isEntryFresh(stored) : false;
}

export function setCached<T>(key: string, data: T, ttlMs = RESPONSE_CACHE_TTL_MS): void {
  const entry: CacheEntry<T> = {
    data,
    expiresAt: Date.now() + ttlMs,
  };

  memory.set(key, entry);
  writeStorageEntry(key, entry);
}

export function invalidateCached(key: string): void {
  memory.delete(key);
  removeStorageEntry(key);
}

export function invalidateCachedNamespace(namespace: string): void {
  const prefix = `${namespace}:`;

  for (const key of [...memory.keys()]) {
    if (key === namespace || key.startsWith(prefix)) {
      memory.delete(key);
    }
  }

  if (typeof sessionStorage === 'undefined') {
    return;
  }

  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const storageKey = sessionStorage.key(index);
    if (!storageKey?.startsWith(STORAGE_PREFIX)) {
      continue;
    }

    const cacheKey = storageKey.slice(STORAGE_PREFIX.length);
    if (cacheKey === namespace || cacheKey.startsWith(prefix)) {
      sessionStorage.removeItem(storageKey);
    }
  }
}

export function clearResponseCache(): void {
  memory.clear();

  if (typeof sessionStorage === 'undefined') {
    return;
  }

  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const storageKey = sessionStorage.key(index);
    if (storageKey?.startsWith(STORAGE_PREFIX)) {
      sessionStorage.removeItem(storageKey);
    }
  }
}

export function isHardPageReload(): boolean {
  const navigation = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;

  return navigation?.type === 'reload';
}

export function hydrateMemoryFromStorage(): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  for (let index = 0; index < sessionStorage.length; index += 1) {
    const storageKey = sessionStorage.key(index);
    if (!storageKey?.startsWith(STORAGE_PREFIX)) {
      continue;
    }

    const cacheKey = storageKey.slice(STORAGE_PREFIX.length);
    if (cacheKey === 'owner-uid') {
      continue;
    }

    const entry = readStorageEntryRaw<unknown>(cacheKey);
    if (entry) {
      memory.set(cacheKey, entry);
    }
  }
}

export function readStaleOnBoot(): void {
  hydrateMemoryFromStorage();
}

export function getCacheOwnerUid(): string | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }

  return sessionStorage.getItem(CACHE_OWNER_UID_KEY);
}

export function setCacheOwnerUid(uid: string): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  sessionStorage.setItem(CACHE_OWNER_UID_KEY, uid);
}

export function clearCacheIfUserChanged(uid: string): void {
  const owner = getCacheOwnerUid();
  if (owner && owner !== uid) {
    invalidateCachedNamespace('profile');
    invalidateCachedNamespace('browse-feed');
    invalidateCachedNamespace('browse-search');
    invalidateCachedNamespace('listing-search');
    invalidateCachedNamespace('tab-inbox-threads');
    invalidateCachedNamespace('tab-selling-listings');
  }

  setCacheOwnerUid(uid);
}

export function initResponseCacheOnPageLoad(): void {
  readStaleOnBoot();
}
