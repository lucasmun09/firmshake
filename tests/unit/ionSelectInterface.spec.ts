import { describe, expect, it } from 'vitest';

import { resolveIonSelectInterface } from '@/common/utils/ionSelectInterface';
import {
  formatToolbarPageName,
  formatToolbarTitle,
  splitToolbarTitle,
} from '@/common/utils/toolbarTitle';

describe('resolveIonSelectInterface', () => {
  it('uses action-sheet at mobile widths', () => {
    expect(resolveIonSelectInterface(375)).toBe('action-sheet');
    expect(resolveIonSelectInterface(768)).toBe('action-sheet');
  });

  it('uses popover above mobile breakpoint', () => {
    expect(resolveIonSelectInterface(769)).toBe('popover');
    expect(resolveIonSelectInterface(1024)).toBe('popover');
  });
});

describe('toolbarTitle', () => {
  it('maps empty or FirmShake to Browse', () => {
    expect(formatToolbarPageName('')).toBe('Browse');
    expect(formatToolbarPageName('FirmShake')).toBe('Browse');
  });

  it('formats full toolbar title', () => {
    expect(formatToolbarTitle('Selling')).toBe('FirmShake - Selling');
    expect(formatToolbarTitle('  Inbox  ')).toBe('FirmShake - Inbox');
  });

  it('splits title for two-line mobile header', () => {
    expect(splitToolbarTitle('Selling')).toEqual({
      line1: 'FirmShake -',
      line2: 'Selling',
    });
    expect(splitToolbarTitle('FirmShake')).toEqual({
      line1: 'FirmShake -',
      line2: 'Browse',
    });
  });
});
