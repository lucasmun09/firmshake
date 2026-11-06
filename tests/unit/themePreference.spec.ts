import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ION_DARK_CLASS,
  applyThemePreference,
  initThemePreferenceOnBoot,
  prefersDarkColorScheme,
  readThemePreference,
  resolveEffectiveDark,
  setThemePreference,
  THEME_PREFERENCE_STORAGE_KEY,
  writeThemePreference,
} from '@/common/services/themePreference';

describe('themePreference', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove(ION_DARK_CLASS);
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove(ION_DARK_CLASS);
    vi.unstubAllGlobals();
  });

  it('defaults to system when storage is empty or invalid', () => {
    expect(readThemePreference()).toBe('system');
    localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'invalid');
    expect(readThemePreference()).toBe('system');
  });

  it('persists and reads theme preference', () => {
    writeThemePreference('dark');
    expect(readThemePreference()).toBe('dark');
    expect(localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe('dark');
  });

  it('resolves effective dark mode from preference and system setting', () => {
    expect(resolveEffectiveDark('light', true)).toBe(false);
    expect(resolveEffectiveDark('dark', false)).toBe(true);
    expect(resolveEffectiveDark('system', true)).toBe(true);
    expect(resolveEffectiveDark('system', false)).toBe(false);
  });

  it('applies ion dark class based on preference', () => {
    applyThemePreference('light');
    expect(document.documentElement.classList.contains(ION_DARK_CLASS)).toBe(false);

    applyThemePreference('dark');
    expect(document.documentElement.classList.contains(ION_DARK_CLASS)).toBe(true);

    applyThemePreference('system');
    expect(document.documentElement.classList.contains(ION_DARK_CLASS)).toBe(
      prefersDarkColorScheme(),
    );
  });

  it('setThemePreference writes storage and applies class', () => {
    setThemePreference('dark');
    expect(readThemePreference()).toBe('dark');
    expect(document.documentElement.classList.contains(ION_DARK_CLASS)).toBe(true);
  });

  it('reacts to system theme changes only in system mode', () => {
    const listeners = new Map<string, Set<(event: MediaQueryListEvent) => void>>();
    const mediaQuery = {
      matches: false,
      addEventListener: vi.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
        if (!listeners.has(event)) {
          listeners.set(event, new Set());
        }
        listeners.get(event)?.add(listener);
      }),
      removeEventListener: vi.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.get(event)?.delete(listener);
      }),
    };

    vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery));

    writeThemePreference('system');
    const cleanup = initThemePreferenceOnBoot();
    expect(document.documentElement.classList.contains(ION_DARK_CLASS)).toBe(false);

    mediaQuery.matches = true;
    listeners.get('change')?.forEach((listener) => {
      listener({ matches: true } as MediaQueryListEvent);
    });
    expect(document.documentElement.classList.contains(ION_DARK_CLASS)).toBe(true);

    writeThemePreference('light');
    applyThemePreference('light');
    mediaQuery.matches = false;
    listeners.get('change')?.forEach((listener) => {
      listener({ matches: false } as MediaQueryListEvent);
    });
    expect(document.documentElement.classList.contains(ION_DARK_CLASS)).toBe(false);

    cleanup();
  });
});
