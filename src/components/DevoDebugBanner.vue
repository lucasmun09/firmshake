<template>
  <div
    v-if="visible"
    class="devo-debug-banner"
    role="region"
    aria-label="Development stack debug tools"
  >
    <div class="devo-debug-banner__label">
      <span class="devo-debug-banner__badge">DEVO</span>
      <span class="devo-debug-banner__text">Development stack</span>
    </div>

    <div class="devo-debug-banner__actions">
      <button
        type="button"
        class="devo-debug-banner__btn"
        :disabled="busy"
        @click="onBypassSms"
      >
        Bypass SMS
      </button>
      <button
        type="button"
        class="devo-debug-banner__btn"
        :disabled="busy"
        @click="onLoadBalance"
      >
        Load balance
      </button>
      <button
        type="button"
        class="devo-debug-banner__btn"
        :disabled="busy"
        @click="onDownloadLogs"
      >
        Download logs
      </button>
      <button
        type="button"
        class="devo-debug-banner__btn devo-debug-banner__btn--ghost"
        :disabled="busy"
        :aria-expanded="!collapsed"
        aria-label="Collapse deovo debug banner"
        @click="collapsed = true"
      >
        Hide
      </button>
    </div>
  </div>

  <button
    v-else-if="enabled"
    type="button"
    class="devo-debug-banner__peek"
    aria-label="Show deovo debug banner"
    @click="collapsed = false"
  >
    DEVO
  </button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { toastController } from '@ionic/vue';

import { isDevoDebugUiEnabled } from '@/common/config/appStack';
import { downloadDebugLogs, debugLog } from '@/common/debug/debugLog';
import {
  bypassDevoSmsVerification,
  formatDevoBalanceDollars,
  loadDevoMockAccountBalance,
} from '@/common/debug/devoDebugTools';

const router = useRouter();
const enabled = isDevoDebugUiEnabled();
const collapsed = ref(false);
const busy = ref(false);

const visible = computed(() => enabled && !collapsed.value);

async function showToast(message: string, color: 'success' | 'warning' | 'danger' | 'medium' = 'medium') {
  const toast = await toastController.create({
    message,
    duration: 4500,
    color,
    position: 'top',
    buttons: [{ text: 'Dismiss', role: 'cancel' }],
  });
  await toast.present();
}

async function onBypassSms() {
  if (busy.value) {
    return;
  }
  busy.value = true;
  try {
    const result = await bypassDevoSmsVerification();
    const path = router.currentRoute.value.path;
    if (path === '/mfa-enroll' || path === '/mfa-challenge') {
      await router.replace('/tabs/home');
    }

    if (result.accountSetupFinalized) {
      await showToast(
        'SMS enrollment bypassed. Account setup marked complete. (Login MFA challenge still needs a real/test SMS code.)',
        'success',
      );
    } else if (result.uid) {
      await showToast(
        'SMS bypass flag set. Could not finalize account setup — try again after signing in.',
        'warning',
      );
    } else {
      await showToast(
        'SMS bypass enabled for this device. Sign in / register to skip enrollment.',
        'success',
      );
    }
  } catch (error) {
    debugLog.error('devo-debug', 'smsBypass.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    await showToast(
      error instanceof Error ? error.message : 'Could not bypass SMS',
      'danger',
    );
  } finally {
    busy.value = false;
  }
}

async function onLoadBalance() {
  if (busy.value) {
    return;
  }
  busy.value = true;
  try {
    const wallet = loadDevoMockAccountBalance();
    await showToast(
      `Devo mock balance loaded: ${formatDevoBalanceDollars(wallet.availableCents)} (client-only; real wallet API not shipped yet).`,
      'success',
    );
  } catch (error) {
    debugLog.error('devo-debug', 'mockWallet.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    await showToast(
      error instanceof Error ? error.message : 'Could not load mock balance',
      'danger',
    );
  } finally {
    busy.value = false;
  }
}

async function onDownloadLogs() {
  if (busy.value) {
    return;
  }
  busy.value = true;
  try {
    const filename = downloadDebugLogs();
    debugLog.info('devo-debug', 'logs.downloaded', { filename });
    await showToast(`Downloaded ${filename}`, 'success');
  } catch (error) {
    debugLog.error('devo-debug', 'logs.downloadFailed', {
      error: error instanceof Error ? error.message : String(error),
    });
    await showToast(
      error instanceof Error ? error.message : 'Could not download logs',
      'danger',
    );
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.devo-debug-banner {
  position: relative;
  z-index: 11;
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem 0.75rem;
  padding: 0.35rem 0.65rem;
  padding-top: calc(0.35rem + env(safe-area-inset-top, 0px));
  background: #b45309;
  color: #fff7ed;
  font-size: 0.75rem;
  line-height: 1.2;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.12);
}

.devo-debug-banner__label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.devo-debug-banner__badge {
  font-weight: 800;
  letter-spacing: 0.06em;
  font-size: 0.7rem;
  padding: 0.12rem 0.35rem;
  border-radius: 0.25rem;
  background: rgba(0, 0, 0, 0.22);
}

.devo-debug-banner__text {
  opacity: 0.95;
  white-space: nowrap;
}

.devo-debug-banner__actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.devo-debug-banner__btn {
  appearance: none;
  border: 1px solid rgba(255, 247, 237, 0.55);
  background: rgba(0, 0, 0, 0.18);
  color: inherit;
  border-radius: 0.3rem;
  padding: 0.28rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.devo-debug-banner__btn:disabled {
  opacity: 0.55;
  cursor: default;
}

.devo-debug-banner__btn:not(:disabled):hover {
  background: rgba(0, 0, 0, 0.28);
}

.devo-debug-banner__btn--ghost {
  border-color: transparent;
  background: transparent;
  font-weight: 500;
  opacity: 0.9;
}

.devo-debug-banner__peek {
  position: fixed;
  top: calc(0.35rem + env(safe-area-inset-top, 0px));
  right: 0.5rem;
  z-index: 10000;
  appearance: none;
  border: none;
  border-radius: 999px;
  padding: 0.35rem 0.65rem;
  background: #b45309;
  color: #fff7ed;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  cursor: pointer;
}
</style>
