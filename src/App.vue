<template>
  <ion-app>
    <DevoDebugBanner />
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';

import DevoDebugBanner from '@/components/DevoDebugBanner.vue';
import { isDevoStack, shouldPersistDebugLogs } from '@/common/config/appStack';
import { debugLog } from '@/common/debug/debugLog';

/**
 * Boot shell lives in index.html until Vue replaces `#app`.
 * Never statically import `@/router` from this file — that pulled Firebase/auth
 * into shared chunks and broke the `/logs` minimal boot (black screen).
 */
function removeBootShell() {
  document.getElementById('app-boot-shell')?.remove();
}

onMounted(() => {
  removeBootShell();
  if (isDevoStack()) {
    debugLog.info('devo-debug', 'devoBanner.active', {
      persistLogs: shouldPersistDebugLogs(),
    });
  }
});
removeBootShell();
window.setTimeout(removeBootShell, 0);
window.setTimeout(removeBootShell, 1500);
</script>
