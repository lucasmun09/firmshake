import { debugLog } from '@/common/debug/debugLog';
import { isDevoDebugUiEnabled } from '@/common/config/appStack';
import {
  isDevoSmsBypassEnabled,
  setDevoSmsBypassEnabled,
} from '@/common/debug/devoSmsBypass';
import { bootstrapProfile } from '@/common/services/appBootstrap';
import { finalizePasswordAccountSetup } from '@/common/services/users';
import { currentUser } from '@/features/auth/services/auth';
import { safeLocalStorageSetItem } from '@/common/services/localStorageQuota';

export {
  DEVO_SMS_BYPASS_KEY,
  isDevoSmsBypassEnabled,
  setDevoSmsBypassEnabled,
} from '@/common/debug/devoSmsBypass';

export const DEVO_MOCK_WALLET_KEY = 'firmshake.devoMockWallet';

/** Default mock wallet load: $100.00 */
export const DEVO_DEFAULT_BALANCE_CENTS = 10_000;

export type DevoMockWallet = {
  availableCents: number;
  currency: 'usd';
  updatedAt: string;
  source: 'devo-debug-banner';
};

/**
 * Enable deovo SMS enrollment bypass and mark the signed-in account setup complete
 * so router guards stop redirecting to `/mfa-enroll`.
 *
 * Does **not** satisfy Firebase MFA challenge for already-enrolled factors —
 * use Google sign-in or a Firebase test phone for that path.
 */
export async function bypassDevoSmsVerification(): Promise<{
  bypassEnabled: boolean;
  accountSetupFinalized: boolean;
  uid: string | null;
}> {
  if (!isDevoDebugUiEnabled()) {
    throw new Error('SMS bypass is only available on the deovo stack');
  }

  setDevoSmsBypassEnabled(true);
  debugLog.info('devo-debug', 'smsBypass.enabled', { stack: 'devo' });

  const uid = currentUser.value?.uid ?? null;
  let accountSetupFinalized = false;

  if (uid) {
    try {
      await finalizePasswordAccountSetup(uid);
      accountSetupFinalized = true;
      if (bootstrapProfile.value?.uid === uid) {
        bootstrapProfile.value = {
          ...bootstrapProfile.value,
          accountSetupComplete: true,
          profileComplete: true,
        };
      }
      debugLog.info('devo-debug', 'smsBypass.accountSetupFinalized', { uid });
    } catch (error) {
      debugLog.warn('devo-debug', 'smsBypass.accountSetupFinalizeFailed', {
        uid,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { bypassEnabled: true, accountSetupFinalized, uid };
}

export function readDevoMockWallet(): DevoMockWallet | null {
  if (!isDevoDebugUiEnabled() || typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(DEVO_MOCK_WALLET_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as DevoMockWallet;
    if (typeof parsed?.availableCents !== 'number' || !Number.isFinite(parsed.availableCents)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Client-side mock wallet for deovo debugging only.
 * Real Stripe Connect / escrow wallet ledger is not implemented yet
 * (see docs/deposit-escrow-payment-plan.md).
 */
export function loadDevoMockAccountBalance(
  availableCents: number = DEVO_DEFAULT_BALANCE_CENTS,
): DevoMockWallet {
  if (!isDevoDebugUiEnabled()) {
    throw new Error('Mock balance is only available on the deovo stack');
  }

  const wallet: DevoMockWallet = {
    availableCents: Math.max(0, Math.floor(availableCents)),
    currency: 'usd',
    updatedAt: new Date().toISOString(),
    source: 'devo-debug-banner',
  };

  if (typeof localStorage !== 'undefined') {
    safeLocalStorageSetItem(DEVO_MOCK_WALLET_KEY, JSON.stringify(wallet));
  }

  debugLog.info('devo-debug', 'mockWallet.loaded', {
    availableCents: wallet.availableCents,
    currency: wallet.currency,
  });

  return wallet;
}

export function formatDevoBalanceDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
