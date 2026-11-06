import { MOBILE_WEB_MEDIA_QUERY } from '@/utils/platform';

export type IonSelectInterface = 'action-sheet' | 'popover';

/** Popovers clip inside fixed drawers/modals; action-sheet works on mobile Safari. */
export function resolveIonSelectInterface(viewportWidth?: number): IonSelectInterface {
  if (viewportWidth != null) {
    return viewportWidth <= 768 ? 'action-sheet' : 'popover';
  }

  if (typeof window === 'undefined') {
    return 'popover';
  }

  return window.matchMedia(MOBILE_WEB_MEDIA_QUERY).matches ? 'action-sheet' : 'popover';
}
