import { isDevoDebugUiEnabled } from '@/common/config/appStack';
import { safeLocalStorageSetItem } from '@/common/services/localStorageQuota';

export const DEVO_SMS_BYPASS_KEY = 'firmshake.devoSmsBypass';

function readLocalFlag(): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  try {
    return localStorage.getItem(DEVO_SMS_BYPASS_KEY) === '1';
  } catch {
    return false;
  }
}

/** Session + durable flag so MFA enrollment can be skipped on deovo. */
export function isDevoSmsBypassEnabled(): boolean {
  if (!isDevoDebugUiEnabled()) {
    return false;
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      if (sessionStorage.getItem(DEVO_SMS_BYPASS_KEY) === '1') {
        return true;
      }
    } catch {
      // fall through
    }
  }
  return readLocalFlag();
}

export function setDevoSmsBypassEnabled(enabled: boolean): void {
  if (!isDevoDebugUiEnabled()) {
    throw new Error('SMS bypass is only available on the deovo stack');
  }

  if (typeof sessionStorage !== 'undefined') {
    try {
      if (enabled) {
        sessionStorage.setItem(DEVO_SMS_BYPASS_KEY, '1');
      } else {
        sessionStorage.removeItem(DEVO_SMS_BYPASS_KEY);
      }
    } catch {
      // ignore
    }
  }

  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    if (enabled) {
      safeLocalStorageSetItem(DEVO_SMS_BYPASS_KEY, '1');
    } else {
      localStorage.removeItem(DEVO_SMS_BYPASS_KEY);
    }
  } catch {
    // ignore quota / private mode
  }
}
