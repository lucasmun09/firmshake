import { buildUserCacheKey } from '@/common/services/responseCache';

const STORAGE_PREFIX = 'firmshake-prefs:';
export const LISTING_PREFS_OWNER_UID_KEY = `${STORAGE_PREFIX}listing-prefs:owner-uid`;

export function listingPrefsStorageKey(uid: string, namespace: string): string {
  return `${STORAGE_PREFIX}${buildUserCacheKey(uid, namespace)}`;
}

export function isListingPrefsStorageAvailable(): boolean {
  return typeof localStorage !== 'undefined';
}

export function getListingPrefsOwnerUid(): string | null {
  if (!isListingPrefsStorageAvailable()) {
    return null;
  }

  return localStorage.getItem(LISTING_PREFS_OWNER_UID_KEY);
}

export function setListingPrefsOwnerUid(uid: string): void {
  if (!isListingPrefsStorageAvailable()) {
    return;
  }

  localStorage.setItem(LISTING_PREFS_OWNER_UID_KEY, uid);
}

export function initListingPrefsStorageOnPageLoad(): void {
  if (getListingPrefsOwnerUid()) {
    return;
  }

  setListingPrefsOwnerUid('anonymous');
}
