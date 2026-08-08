import { buildUserCacheKey } from '@/common/services/responseCache';
import type { BrowseSort } from '@/features/listings/services/browseSearch';
import type { MapViewportSearch } from '@/features/listings/utils/browseMapView';
import type { Listing } from '@/types';

export const BROWSE_LOCAL_CACHE_VERSION = 1;
export const BROWSE_LOCAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const BROWSE_LOCAL_CACHE_MAX_ITEMS = 300;

const STORAGE_PREFIX = 'firmshake-browse-local:';
export const BROWSE_LOCAL_OWNER_UID_KEY = `${STORAGE_PREFIX}owner-uid`;

const ALL_NAMESPACE = 'browse-local-all';
const SEARCH_NAMESPACE = 'browse-local-search';
const MAP_NAMESPACE = 'browse-local-map';

interface StoredListing extends Omit<Listing, 'createdAt'> {
  createdAt?: string;
}

export interface BrowseLocalCachePayload {
  version: number;
  orderedIds: string[];
  listingsById: Record<string, StoredListing>;
  hasMore: boolean;
  searchPage?: number;
  searchQuery?: string;
  viewport?: MapViewportSearch;
  cachedAt: number;
}

interface BrowseLocalStorageEntry {
  data: BrowseLocalCachePayload;
  expiresAt: number;
}

export interface BrowseLocalFilterKeyParams {
  communityId: string;
  categoryId?: string;
  q?: string;
  priceMin?: number | null;
  priceMax?: number | null;
  lat?: number | null;
  lng?: number | null;
  radiusMiles?: number;
  sort?: BrowseSort;
}

function reviveListing(stored: StoredListing): Listing {
  return {
    ...stored,
    createdAt: stored.createdAt ? new Date(stored.createdAt) : undefined,
  };
}

function serializeListing(listing: Listing): StoredListing {
  return {
    ...listing,
    createdAt: listing.createdAt?.toISOString(),
  };
}

function isStorageAvailable(): boolean {
  return typeof localStorage !== 'undefined';
}

function readEntry(key: string): BrowseLocalStorageEntry | null {
  if (!isStorageAvailable()) {
    return null;
  }

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as BrowseLocalStorageEntry;
    if (
      typeof parsed.expiresAt !== 'number' ||
      !parsed.data ||
      parsed.data.version !== BROWSE_LOCAL_CACHE_VERSION
    ) {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeEntry(key: string, entry: BrowseLocalStorageEntry): void {
  if (!isStorageAvailable()) {
    return;
  }

  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // Ignore quota errors.
  }
}

function removeEntry(key: string): void {
  if (!isStorageAvailable()) {
    return;
  }

  localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
}

function filterKeyParams(params: BrowseLocalFilterKeyParams): Record<string, string | number> {
  return {
    community: params.communityId,
    category: params.categoryId ?? '',
    q: params.q?.trim() ?? '',
    minPrice: params.priceMin ?? '',
    maxPrice: params.priceMax ?? '',
    lat: params.lat ?? '',
    lng: params.lng ?? '',
    radiusMiles: params.radiusMiles ?? '',
    sort: params.sort ?? 'newest',
  };
}

export function buildBrowseLocalAllKey(
  uid: string,
  params: BrowseLocalFilterKeyParams,
): string {
  return buildUserCacheKey(uid, ALL_NAMESPACE, filterKeyParams(params));
}

export function buildBrowseLocalSearchKey(
  uid: string,
  params: BrowseLocalFilterKeyParams,
): string {
  return buildUserCacheKey(uid, SEARCH_NAMESPACE, filterKeyParams(params));
}

export function roundCoordinate(value: number, precision = 3): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function buildBrowseLocalMapKey(uid: string, viewport: MapViewportSearch): string {
  return buildUserCacheKey(uid, MAP_NAMESPACE, {
    lat: roundCoordinate(viewport.lat),
    lng: roundCoordinate(viewport.lng),
    radiusMiles: viewport.radiusMiles,
    north: roundCoordinate(viewport.north),
    south: roundCoordinate(viewport.south),
    east: roundCoordinate(viewport.east),
    west: roundCoordinate(viewport.west),
    zoom: viewport.zoom,
  });
}

const BROWSE_LOCAL_LISTING_NAMESPACES = [ALL_NAMESPACE, SEARCH_NAMESPACE, MAP_NAMESPACE];

function isBrowseLocalListingCacheKey(key: string): boolean {
  return BROWSE_LOCAL_LISTING_NAMESPACES.some((namespace) => key.includes(namespace));
}

/** Removes a listing from every browse-local cache bucket (all, search, map). */
export function removeListingFromAllBrowseLocalCaches(listingId: string): number {
  if (!isStorageAvailable()) {
    return 0;
  }

  let updatedCount = 0;

  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const storageKey = localStorage.key(index);
    if (!storageKey?.startsWith(STORAGE_PREFIX)) {
      continue;
    }

    const key = storageKey.slice(STORAGE_PREFIX.length);
    if (!isBrowseLocalListingCacheKey(key)) {
      continue;
    }

    const entry = readEntry(key);
    if (!entry?.data.listingsById[listingId]) {
      continue;
    }

    const nextOrderedIds = entry.data.orderedIds.filter((id) => id !== listingId);
    const nextListingsById = { ...entry.data.listingsById };
    delete nextListingsById[listingId];

    if (nextOrderedIds.length === 0) {
      removeEntry(key);
    } else {
      writeEntry(key, {
        ...entry,
        data: {
          ...entry.data,
          orderedIds: nextOrderedIds,
          listingsById: nextListingsById,
        },
      });
    }

    updatedCount += 1;
  }

  return updatedCount;
}

export function listingsFromCachePayload(payload: BrowseLocalCachePayload): Listing[] {
  return payload.orderedIds
    .map((id) => payload.listingsById[id])
    .filter(Boolean)
    .map(reviveListing);
}

export function getBrowseLocalCache(key: string): BrowseLocalCachePayload | null {
  const entry = readEntry(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    return null;
  }

  return entry.data;
}

export function getStaleBrowseLocalCache(key: string): BrowseLocalCachePayload | null {
  const entry = readEntry(key);
  return entry?.data ?? null;
}

export function setBrowseLocalCache(key: string, payload: BrowseLocalCachePayload): void {
  writeEntry(key, {
    data: payload,
    expiresAt: Date.now() + BROWSE_LOCAL_CACHE_TTL_MS,
  });
}

export function invalidateBrowseLocalCache(key: string): void {
  removeEntry(key);
}

export function invalidateBrowseLocalCacheNamespace(namespace: string): void {
  if (!isStorageAvailable()) {
    return;
  }

  const prefix = `${STORAGE_PREFIX}${namespace}:`;
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const storageKey = localStorage.key(index);
    if (!storageKey?.startsWith(prefix)) {
      continue;
    }
    localStorage.removeItem(storageKey);
  }
}

export function getBrowseLocalCacheOwnerUid(): string | null {
  if (!isStorageAvailable()) {
    return null;
  }

  return localStorage.getItem(BROWSE_LOCAL_OWNER_UID_KEY);
}

export function setBrowseLocalCacheOwnerUid(uid: string): void {
  if (!isStorageAvailable()) {
    return;
  }

  localStorage.setItem(BROWSE_LOCAL_OWNER_UID_KEY, uid);
}

export function clearBrowseLocalCacheIfUserChanged(uid: string): void {
  const owner = getBrowseLocalCacheOwnerUid();
  if (owner && owner !== uid) {
    invalidateBrowseLocalCacheNamespace(ALL_NAMESPACE);
    invalidateBrowseLocalCacheNamespace(SEARCH_NAMESPACE);
    invalidateBrowseLocalCacheNamespace(MAP_NAMESPACE);
  }

  setBrowseLocalCacheOwnerUid(uid);
}

/** Fresh API results first; previously cached items follow without duplicates. */
export function mergeFreshBrowseResultsOnTop(
  freshListings: Listing[],
  cachedListings: Listing[],
): Listing[] {
  if (cachedListings.length === 0) {
    return freshListings;
  }

  const freshIds = new Set(freshListings.map((listing) => listing.id));
  const staleTail = cachedListings.filter((listing) => !freshIds.has(listing.id));
  return [...freshListings, ...staleTail];
}

export function buildBrowseLocalCachePayload(
  listings: Listing[],
  meta: {
    hasMore: boolean;
    searchPage?: number;
    searchQuery?: string;
    viewport?: MapViewportSearch;
  },
): BrowseLocalCachePayload {
  const capped = listings.slice(0, BROWSE_LOCAL_CACHE_MAX_ITEMS);
  const listingsById: Record<string, StoredListing> = {};

  for (const listing of capped) {
    listingsById[listing.id] = serializeListing(listing);
  }

  return {
    version: BROWSE_LOCAL_CACHE_VERSION,
    orderedIds: capped.map((listing) => listing.id),
    listingsById,
    hasMore: meta.hasMore,
    searchPage: meta.searchPage,
    searchQuery: meta.searchQuery,
    viewport: meta.viewport,
    cachedAt: Date.now(),
  };
}

export function persistBrowseLocalPool(
  key: string,
  listings: Listing[],
  meta: {
    hasMore: boolean;
    searchPage?: number;
    searchQuery?: string;
    viewport?: MapViewportSearch;
  },
): void {
  if (listings.length === 0) {
    return;
  }

  const payload = buildBrowseLocalCachePayload(listings, meta);
  const existing = getStaleBrowseLocalCache(key);
  if (
    existing &&
    existing.hasMore === payload.hasMore &&
    existing.searchPage === payload.searchPage &&
    existing.orderedIds.length === payload.orderedIds.length &&
    existing.orderedIds[0] === payload.orderedIds[0] &&
    existing.orderedIds[existing.orderedIds.length - 1] ===
      payload.orderedIds[payload.orderedIds.length - 1]
  ) {
    return;
  }

  setBrowseLocalCache(key, payload);
}

export function resolveBrowseLocalCacheKey(
  uid: string,
  params: BrowseLocalFilterKeyParams,
): string {
  const query = params.q?.trim() ?? '';
  if (query.length > 0) {
    return buildBrowseLocalSearchKey(uid, params);
  }

  return buildBrowseLocalAllKey(uid, params);
}

export function buildBrowseLocalFilterKeyParams(input: {
  communityId: string;
  categoryId?: string;
  q?: string;
  priceMin?: number | null;
  priceMax?: number | null;
  lat?: number | null;
  lng?: number | null;
  radiusMiles?: number;
  sort?: BrowseSort;
}): BrowseLocalFilterKeyParams {
  return {
    communityId: input.communityId,
    categoryId: input.categoryId,
    q: input.q,
    priceMin: input.priceMin,
    priceMax: input.priceMax,
    lat: input.lat,
    lng: input.lng,
    radiusMiles: input.radiusMiles,
    sort: input.sort,
  };
}

export function initBrowseLocalCacheOnPageLoad(): void {
  const owner = getBrowseLocalCacheOwnerUid();
  if (owner) {
    return;
  }

  // Guest/anonymous browse uses a stable owner key until auth resolves.
  setBrowseLocalCacheOwnerUid('anonymous');
}
