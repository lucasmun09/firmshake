import { describe, expect, it } from 'vitest';

import {
  browseViewLabel,
  browseViewOptions,
  DEFAULT_BROWSE_VIEW_MODE,
  normalizeBrowseViewMode,
} from '@/features/listings/types/browseViewMode';

describe('browseViewMode', () => {
  it('returns all view options when map is enabled', () => {
    expect(browseViewOptions(true).map((option) => option.value)).toEqual([
      'cards',
      'map',
      'list',
    ]);
  });

  it('hides map when BFF browse is disabled', () => {
    expect(browseViewOptions(false).map((option) => option.value)).toEqual(['cards', 'list']);
  });

  it('normalizes map to list when map is unavailable', () => {
    expect(normalizeBrowseViewMode('map', false)).toBe('list');
    expect(normalizeBrowseViewMode('map', true)).toBe('map');
    expect(normalizeBrowseViewMode('cards', false)).toBe('cards');
  });

  it('returns human-readable labels', () => {
    expect(browseViewLabel('list')).toBe('List');
    expect(browseViewLabel('map')).toBe('Map');
    expect(browseViewLabel('cards')).toBe('Cards');
  });

  it('defaults to cards view mode', () => {
    expect(DEFAULT_BROWSE_VIEW_MODE).toBe('cards');
  });
});
