export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_PREFERENCE_STORAGE_KEY = 'firmshake.themePreference';
export const ION_DARK_CLASS = 'ion-palette-dark';

const VALID_PREFERENCES: ThemePreference[] = ['light', 'dark', 'system'];

function isStorageAvailable(): boolean {
  return typeof localStorage !== 'undefined';
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && VALID_PREFERENCES.includes(value as ThemePreference);
}

export function readThemePreference(): ThemePreference {
  if (!isStorageAvailable()) {
    return 'system';
  }

  const stored = localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY);
  return isThemePreference(stored) ? stored : 'system';
}

export function writeThemePreference(preference: ThemePreference): void {
  if (!isStorageAvailable()) {
    return;
  }

  localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
}

export function prefersDarkColorScheme(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveEffectiveDark(
  preference: ThemePreference,
  prefersDark: boolean = prefersDarkColorScheme(),
): boolean {
  if (preference === 'dark') {
    return true;
  }
  if (preference === 'light') {
    return false;
  }
  return prefersDark;
}

export function applyThemePreference(preference: ThemePreference = readThemePreference()): void {
  if (typeof document === 'undefined') {
    return;
  }

  const useDark = resolveEffectiveDark(preference);
  document.documentElement.classList.toggle(ION_DARK_CLASS, useDark);
}

export function initThemePreferenceOnBoot(): () => void {
  applyThemePreference();

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handleSystemChange = () => {
    if (readThemePreference() !== 'system') {
      return;
    }
    applyThemePreference('system');
  };

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }

  mediaQuery.addListener(handleSystemChange);
  return () => mediaQuery.removeListener(handleSystemChange);
}

export function setThemePreference(preference: ThemePreference): void {
  writeThemePreference(preference);
  applyThemePreference(preference);
}
