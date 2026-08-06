import { Capacitor } from '@capacitor/core';

export const MOBILE_WEB_MEDIA_QUERY = '(max-width: 768px)';

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function isMobileWebViewport(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.matchMedia(MOBILE_WEB_MEDIA_QUERY).matches;
}

/** Mobile browser (not Capacitor native). */
export function isMobileWeb(): boolean {
  return !isNativePlatform() && isMobileWebViewport();
}

/** Desktop or tablet web browser. */
export function isDesktopWeb(): boolean {
  return !isNativePlatform() && !isMobileWebViewport();
}
