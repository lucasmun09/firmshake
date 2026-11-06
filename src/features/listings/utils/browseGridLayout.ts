/** Grid breakpoints aligned with BrowseCardsView / HomePage skeleton CSS. */
const GRID_BREAKPOINTS = [
  { minWidth: 1024, minColumnRem: 12.5, gapRem: 0.85 },
  { minWidth: 768, minColumnRem: 11.5, gapRem: 0.85 },
  { minWidth: 480, minColumnRem: 10.5, gapRem: 0.75 },
  { minWidth: 0, minColumnRem: 9.5, gapRem: 0.65 },
] as const;

/** Fallback rows before the browse grid viewport is measured. */
export const BROWSE_GRID_DEFAULT_ROW_COUNT = 3;

export interface BrowseGridLayout {
  minColumnPx: number;
  gapPx: number;
}

export function getBrowseGridLayout(viewportWidth: number): BrowseGridLayout {
  const breakpoint =
    GRID_BREAKPOINTS.find((entry) => viewportWidth >= entry.minWidth) ??
    GRID_BREAKPOINTS[GRID_BREAKPOINTS.length - 1];

  return {
    minColumnPx: breakpoint.minColumnRem * 16,
    gapPx: breakpoint.gapRem * 16,
  };
}

/** Matches `repeat(auto-fill, minmax(...))` column count for a container width. */
export function getBrowseGridColumnCount(
  containerWidth: number,
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024,
): number {
  if (containerWidth <= 0) {
    return 1;
  }

  const { minColumnPx, gapPx } = getBrowseGridLayout(viewportWidth);
  return Math.max(1, Math.floor((containerWidth + gapPx) / (minColumnPx + gapPx)));
}

export function roundUpToMultiple(value: number, unit: number): number {
  if (unit <= 0) {
    return value;
  }

  return Math.ceil(value / unit) * unit;
}

export function roundDownToMultiple(value: number, unit: number): number {
  if (unit <= 0) {
    return value;
  }

  return Math.floor(value / unit) * unit;
}

/** Empty slots in the last row (0 when the row is already full). */
export function incompleteRowSlots(itemCount: number, columnCount: number): number {
  if (columnCount <= 1 || itemCount <= 0) {
    return 0;
  }

  const remainder = itemCount % columnCount;
  return remainder === 0 ? 0 : columnCount - remainder;
}

/** Square card cell height for a measured grid container width. */
export function getBrowseGridCellHeightPx(
  containerWidth: number,
  columnCount: number,
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024,
): number {
  const { minColumnPx, gapPx } = getBrowseGridLayout(viewportWidth);
  const columns = Math.max(1, columnCount);

  if (containerWidth <= 0) {
    return minColumnPx;
  }

  const cellWidth = (containerWidth - gapPx * (columns - 1)) / columns;
  return Math.max(minColumnPx, cellWidth);
}

/** Scroll stride per grid row (cell height + gap below). */
export function getBrowseGridRowHeightPx(
  containerWidth: number,
  columnCount: number,
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024,
): number {
  const { gapPx } = getBrowseGridLayout(viewportWidth);
  return getBrowseGridCellHeightPx(containerWidth, columnCount, viewportWidth) + gapPx;
}

/**
 * Full rows that fit in the available viewport height above the grid.
 * Uses N*cell + (N-1)*gap <= height, solved as floor((height + gap) / (cell + gap)).
 */
export function getBrowseGridRowCount(
  availableHeightPx: number,
  cellHeightPx: number,
  gapPx: number,
): number {
  if (availableHeightPx <= 0 || cellHeightPx <= 0) {
    return 1;
  }

  const stride = cellHeightPx + gapPx;
  return Math.max(1, Math.floor((availableHeightPx + gapPx) / stride));
}

/** Cards per fetch/reveal batch: complete rows that fill the visible viewport. */
export function getBrowseFeedPageSize(
  columnCount: number,
  rowCount = BROWSE_GRID_DEFAULT_ROW_COUNT,
): number {
  const columns = Math.max(1, columnCount);
  const rows = Math.max(1, rowCount);
  return columns * rows;
}
