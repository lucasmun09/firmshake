export type BrowseViewMode = 'list' | 'map' | 'cards';

export const DEFAULT_BROWSE_VIEW_MODE: BrowseViewMode = 'cards';

export const BROWSE_VIEW_OPTIONS: { value: BrowseViewMode; label: string }[] = [
  { value: 'cards', label: 'Cards' },
  { value: 'map', label: 'Map' },
  { value: 'list', label: 'List' },
];

export function browseViewOptions(showMap: boolean): { value: BrowseViewMode; label: string }[] {
  if (showMap) {
    return BROWSE_VIEW_OPTIONS;
  }
  return BROWSE_VIEW_OPTIONS.filter((option) => option.value !== 'map');
}

export function browseViewLabel(mode: BrowseViewMode): string {
  return BROWSE_VIEW_OPTIONS.find((option) => option.value === mode)?.label ?? 'List';
}

export function normalizeBrowseViewMode(
  mode: BrowseViewMode,
  showMap: boolean,
): BrowseViewMode {
  if (mode === 'map' && !showMap) {
    return 'list';
  }
  return mode;
}
