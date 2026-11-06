import {
  DEFAULT_BROWSE_VIEW_MODE,
  normalizeBrowseViewMode,
  type BrowseViewMode,
} from '@/features/listings/types/browseViewMode';

const STORAGE_KEY = 'firmshake.browseViewMode';

export function loadPersistedBrowseViewMode(showMap = true): BrowseViewMode {
  if (typeof sessionStorage === 'undefined') {
    return DEFAULT_BROWSE_VIEW_MODE;
  }

  const stored = sessionStorage.getItem(STORAGE_KEY)?.trim() as BrowseViewMode | undefined;
  if (stored === 'list' || stored === 'map' || stored === 'cards') {
    return normalizeBrowseViewMode(stored, showMap);
  }

  return DEFAULT_BROWSE_VIEW_MODE;
}

export function persistBrowseViewMode(mode: BrowseViewMode): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  sessionStorage.setItem(STORAGE_KEY, mode);
}
