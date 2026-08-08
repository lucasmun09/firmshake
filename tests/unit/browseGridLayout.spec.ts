import { describe, expect, it } from 'vitest';

import {
  BROWSE_GRID_DEFAULT_ROW_COUNT,
  getBrowseFeedPageSize,
  getBrowseGridCellHeightPx,
  getBrowseGridColumnCount,
  getBrowseGridLayout,
  getBrowseGridRowCount,
  getBrowseGridRowHeightPx,
  incompleteRowSlots,
  roundDownToMultiple,
  roundUpToMultiple,
} from '@/features/listings/utils/browseGridLayout';

describe('browseGridLayout', () => {
  describe('getBrowseGridColumnCount', () => {
    it('matches auto-fill column math at desktop widths', () => {
      expect(getBrowseGridColumnCount(1200, 1200)).toBe(5);
      expect(getBrowseGridColumnCount(900, 900)).toBe(4);
      expect(getBrowseGridColumnCount(600, 600)).toBe(3);
    });

    it('returns at least one column for narrow containers', () => {
      expect(getBrowseGridColumnCount(200, 375)).toBe(1);
      expect(getBrowseGridColumnCount(0, 375)).toBe(1);
    });
  });

  describe('getBrowseGridRowCount', () => {
    it('counts full rows that fit in the available viewport height', () => {
      const { gapPx } = getBrowseGridLayout(1200);
      const cellHeight = 200;

      expect(getBrowseGridRowCount(600, cellHeight, gapPx)).toBe(2);
      expect(getBrowseGridRowCount(799, cellHeight, gapPx)).toBe(3);
      expect(getBrowseGridRowCount(840, cellHeight, gapPx)).toBe(3);
      expect(getBrowseGridRowCount(841, cellHeight, gapPx)).toBe(4);
    });

    it('returns at least one row', () => {
      expect(getBrowseGridRowCount(0, 200, 12)).toBe(1);
    });
  });

  describe('incompleteRowSlots', () => {
    it('returns empty slots needed to complete the last row', () => {
      expect(incompleteRowSlots(18, 5)).toBe(2);
      expect(incompleteRowSlots(20, 5)).toBe(0);
      expect(incompleteRowSlots(19, 5)).toBe(1);
      expect(incompleteRowSlots(0, 5)).toBe(0);
    });
  });

  describe('roundUpToMultiple / roundDownToMultiple', () => {
    it('aligns counts to grid columns', () => {
      expect(roundUpToMultiple(18, 5)).toBe(20);
      expect(roundDownToMultiple(18, 5)).toBe(15);
    });
  });

  describe('getBrowseFeedPageSize', () => {
    it('uses columns times measured viewport rows', () => {
      expect(getBrowseFeedPageSize(5, 3)).toBe(15);
      expect(getBrowseFeedPageSize(5)).toBe(5 * BROWSE_GRID_DEFAULT_ROW_COUNT);
      expect(getBrowseFeedPageSize(1, 4)).toBe(4);
    });
  });

  describe('getBrowseGridRowHeightPx', () => {
    it('uses container width rather than the full viewport width', () => {
      const containerWidth = 900;
      const viewportWidth = 1200;
      const columns = getBrowseGridColumnCount(containerWidth, viewportWidth);
      const rowHeight = getBrowseGridRowHeightPx(containerWidth, columns, viewportWidth);
      const cellHeight = getBrowseGridCellHeightPx(containerWidth, columns, viewportWidth);
      const { gapPx } = getBrowseGridLayout(viewportWidth);

      expect(rowHeight).toBe(cellHeight + gapPx);
      expect(rowHeight).toBeLessThan(getBrowseGridRowHeightPx(viewportWidth, columns, viewportWidth));
    });
  });

  describe('getBrowseGridLayout', () => {
    it('uses wider min columns at larger breakpoints', () => {
      const mobile = getBrowseGridLayout(375);
      const desktop = getBrowseGridLayout(1200);
      expect(desktop.minColumnPx).toBeGreaterThan(mobile.minColumnPx);
    });
  });
});
