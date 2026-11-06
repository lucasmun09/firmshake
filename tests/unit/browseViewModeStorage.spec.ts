import { describe, expect, it, beforeEach, vi } from 'vitest';

import {
  DEFAULT_BROWSE_VIEW_MODE,
  type BrowseViewMode,
} from '@/features/listings/types/browseViewMode';
import {
  loadPersistedBrowseViewMode,
  persistBrowseViewMode,
} from '@/features/listings/services/browseViewModeStorage';

describe('browseViewModeStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('defaults to cards when nothing is stored', () => {
    expect(loadPersistedBrowseViewMode()).toBe(DEFAULT_BROWSE_VIEW_MODE);
    expect(DEFAULT_BROWSE_VIEW_MODE).toBe('cards');
  });

  it('persists and reloads the selected view mode', () => {
    persistBrowseViewMode('list');
    expect(loadPersistedBrowseViewMode()).toBe('list');
  });

  it('normalizes stored map mode when map is unavailable', () => {
    persistBrowseViewMode('map');
    expect(loadPersistedBrowseViewMode(false)).toBe('list');
    expect(loadPersistedBrowseViewMode(true)).toBe('map');
  });
});
