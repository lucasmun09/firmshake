import { isMobileWeb, isNativePlatform } from '@/utils/platform';

export const LANDING_PATH = '/welcome';
export const GUEST_BROWSE_PATH = '/tabs/home';
export const NATIVE_ENTRY_PATH = '/login';
export const AUTHENTICATED_ROOT_PATH = GUEST_BROWSE_PATH;

/** Unauthenticated entry destination by platform. */
export function resolveGuestRootPath(): string {
  if (isNativePlatform()) {
    return NATIVE_ENTRY_PATH;
  }
  if (isMobileWeb()) {
    return GUEST_BROWSE_PATH;
  }
  return LANDING_PATH;
}

/** Auth-aware `/` and `/welcome` destination. */
export function resolveRootDestination(isLoggedIn: boolean): string {
  if (isLoggedIn) {
    return AUTHENTICATED_ROOT_PATH;
  }
  return resolveGuestRootPath();
}
