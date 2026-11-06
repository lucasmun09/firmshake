import { debugLog, serializeError } from '@/common/debug/debugLog';

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const GIS_SCRIPT_ATTR = 'data-firmshake-gis';

export type GoogleSignInStrategy = 'gis-credential' | 'popup' | 'redirect';

export type GoogleIdCredentialResponse = {
  credential: string;
  select_by?: string;
  clientId?: string;
};

export type GooglePromptMomentNotification = {
  isDisplayMoment: () => boolean;
  isDisplayed: () => boolean;
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
  getNotDisplayedReason?: () => string;
  getSkippedReason?: () => string;
  getDismissedReason?: () => string;
};

export type GoogleIdConfiguration = {
  client_id: string;
  callback: (response: GoogleIdCredentialResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  context?: 'signin' | 'signup' | 'use';
  itp_support?: boolean;
  use_fedcm_for_prompt?: boolean;
  use_fedcm_for_button?: boolean;
};

export type GsiButtonConfiguration = {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: number | string;
  locale?: string;
};

type GoogleAccountsId = {
  initialize: (config: GoogleIdConfiguration) => void;
  prompt: (momentListener?: (notification: GooglePromptMomentNotification) => void) => void;
  renderButton: (parent: HTMLElement, options: GsiButtonConfiguration) => void;
  cancel: () => void;
  disableAutoSelect: () => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleAccountsId;
      };
    };
  }
}

export class GoogleIdentityError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'GoogleIdentityError';
    this.code = code;
  }
}

let loadPromise: Promise<void> | null = null;

export function getGoogleWebClientId(): string | null {
  const value = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID?.trim();
  return value || null;
}

export function isGoogleIdentityConfigured(): boolean {
  return Boolean(getGoogleWebClientId());
}

/**
 * Default Google button behavior for `loginWithGoogle` (Ionic fallback / native).
 * In-page GIS uses `loginWithGoogleIdToken` via GoogleSignInButton — not this path.
 * Popup is opt-in only (`allowPopupFallback`).
 */
export function resolveGoogleSignInStrategy(options: {
  isNativePlatform: boolean;
  hasGoogleWebClientId: boolean;
  allowPopupFallback?: boolean;
}): GoogleSignInStrategy {
  if (options.isNativePlatform) {
    return 'redirect';
  }

  // GIS client ID enables the official Google button overlay in GoogleSignInButton.
  // The Ionic "Continue with Google" fallback always uses same-tab redirect so
  // login works without VITE_GOOGLE_WEB_CLIENT_ID.
  if (options.allowPopupFallback) {
    return 'popup';
  }

  return 'redirect';
}

export async function loadGoogleIdentityServices(): Promise<void> {
  if (typeof window === 'undefined') {
    throw new GoogleIdentityError('gis/ssr', 'Google Identity Services requires a browser');
  }

  if (window.google?.accounts?.id) {
    return;
  }

  if (!loadPromise) {
    loadPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[${GIS_SCRIPT_ATTR}="true"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener(
          'error',
          () => reject(new GoogleIdentityError('gis/load-failed', 'Failed to load Google Identity Services')),
          { once: true },
        );
        if (window.google?.accounts?.id) {
          resolve();
        }
        return;
      }

      const script = document.createElement('script');
      script.src = GIS_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.setAttribute(GIS_SCRIPT_ATTR, 'true');
      script.onload = () => resolve();
      script.onerror = () => {
        loadPromise = null;
        reject(new GoogleIdentityError('gis/load-failed', 'Failed to load Google Identity Services'));
      };
      document.head.appendChild(script);
    });
  }

  await loadPromise;

  if (!window.google?.accounts?.id) {
    loadPromise = null;
    throw new GoogleIdentityError('gis/unavailable', 'Google Identity Services did not initialize');
  }
}

function getAccountsId(): GoogleAccountsId {
  const accountsId = window.google?.accounts?.id;
  if (!accountsId) {
    throw new GoogleIdentityError('gis/unavailable', 'Google Identity Services is not ready');
  }
  return accountsId;
}

export function initializeGoogleIdentity(options: {
  callback: (response: GoogleIdCredentialResponse) => void;
  context?: GoogleIdConfiguration['context'];
  autoSelect?: boolean;
}): void {
  const clientId = getGoogleWebClientId();
  if (!clientId) {
    throw new GoogleIdentityError(
      'gis/not-configured',
      'Set VITE_GOOGLE_WEB_CLIENT_ID to enable in-page Google Sign-In',
    );
  }

  getAccountsId().initialize({
    client_id: clientId,
    callback: options.callback,
    auto_select: options.autoSelect ?? false,
    cancel_on_tap_outside: true,
    context: options.context ?? 'signin',
    itp_support: true,
    use_fedcm_for_prompt: true,
    use_fedcm_for_button: true,
  });
}

export function renderGoogleSignInButton(
  parent: HTMLElement,
  options: GsiButtonConfiguration = {},
): void {
  const width = Math.max(220, Math.floor(parent.clientWidth || 320));
  getAccountsId().renderButton(parent, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'left',
    width,
    ...options,
  });
}

/**
 * Show Google One Tap / FedCM overlay. Resolves with an ID token JWT, or rejects
 * with a typed GoogleIdentityError when the prompt is unavailable/dismissed.
 */
export function promptGoogleOneTap(options?: {
  context?: GoogleIdConfiguration['context'];
  timeoutMs?: number;
}): Promise<string> {
  const timeoutMs = options?.timeoutMs ?? 45_000;

  return new Promise<string>((resolve, reject) => {
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeout);
      fn();
    };

    const timeout = window.setTimeout(() => {
      try {
        getAccountsId().cancel();
      } catch {
        /* ignore */
      }
      settle(() => reject(new GoogleIdentityError('gis/timeout', 'Google sign-in timed out')));
    }, timeoutMs);

    try {
      initializeGoogleIdentity({
        context: options?.context,
        callback: (response) => {
          if (response.credential) {
            debugLog.info('auth', 'Google GIS: credential received', {
              selectBy: response.select_by ?? null,
              hasCredential: true,
            });
            settle(() => resolve(response.credential));
            return;
          }
          settle(() => reject(new GoogleIdentityError('gis/empty-credential', 'Google returned no credential')));
        },
      });
    } catch (err) {
      settle(() => reject(err));
      return;
    }

    getAccountsId().prompt((notification) => {
      if (notification.isDisplayed?.() || notification.isDisplayMoment?.()) {
        debugLog.info('auth', 'Google GIS: One Tap / FedCM displayed');
        return;
      }

      if (notification.isNotDisplayed?.()) {
        const reason = notification.getNotDisplayedReason?.() ?? 'unknown';
        debugLog.info('auth', 'Google GIS: One Tap not displayed', { reason });
        settle(() => reject(new GoogleIdentityError('gis/not-displayed', `Google One Tap not displayed (${reason})`)));
        return;
      }

      if (notification.isSkippedMoment?.()) {
        const reason = notification.getSkippedReason?.() ?? 'unknown';
        debugLog.info('auth', 'Google GIS: One Tap skipped', { reason });
        settle(() => reject(new GoogleIdentityError('gis/skipped', `Google One Tap skipped (${reason})`)));
        return;
      }

      if (notification.isDismissedMoment?.()) {
        const reason = notification.getDismissedReason?.() ?? 'unknown';
        debugLog.info('auth', 'Google GIS: One Tap dismissed', { reason });
        if (reason === 'credential_returned') {
          return;
        }
        settle(() => reject(new GoogleIdentityError('gis/dismissed', `Google One Tap dismissed (${reason})`)));
      }
    });
  });
}

export async function requestGoogleIdToken(options?: {
  context?: GoogleIdConfiguration['context'];
  preferPrompt?: boolean;
}): Promise<string> {
  const clientId = getGoogleWebClientId();
  if (!clientId) {
    throw new GoogleIdentityError(
      'gis/not-configured',
      'Set VITE_GOOGLE_WEB_CLIENT_ID to enable in-page Google Sign-In',
    );
  }

  debugLog.info('auth', 'Google GIS: requestIdToken.start', {
    preferPrompt: options?.preferPrompt !== false,
    context: options?.context ?? 'signin',
    origin: typeof window !== 'undefined' ? window.location.origin : undefined,
  });

  try {
    await loadGoogleIdentityServices();
  } catch (err) {
    debugLog.error('auth', 'Google GIS: script load failed', { error: serializeError(err) });
    throw err;
  }

  if (options?.preferPrompt === false) {
    throw new GoogleIdentityError(
      'gis/prompt-disabled',
      'Google One Tap prompt disabled; use the in-page Google button',
    );
  }

  return promptGoogleOneTap({ context: options?.context });
}

export function isGoogleIdentityUserCancel(err: unknown): boolean {
  if (!(err instanceof GoogleIdentityError)) {
    return false;
  }
  // Only treat an explicit One Tap dismiss as cancel; skipped/not-displayed should fall back.
  return err.code === 'gis/dismissed';
}

export function isGoogleIdentityRecoverable(err: unknown): boolean {
  if (!(err instanceof GoogleIdentityError)) {
    return true;
  }
  return [
    'gis/not-displayed',
    'gis/skipped',
    'gis/dismissed',
    'gis/timeout',
    'gis/prompt-disabled',
    'gis/load-failed',
    'gis/unavailable',
    'gis/not-configured',
  ].includes(err.code);
}
