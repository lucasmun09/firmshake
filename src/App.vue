<template>
  <div class="app-shell">
    <DevoDebugBanner />
    <ion-app>
      <ion-router-outlet />
    </ion-app>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';

import DevoDebugBanner from '@/components/DevoDebugBanner.vue';
import { isDevoDebugUiEnabled, shouldPersistDebugLogs } from '@/common/config/appStack';
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
  if (isDevoDebugUiEnabled()) {
    debugLog.info('devo-debug', 'devoBanner.active', {
      persistLogs: shouldPersistDebugLogs(),
    });
  }
});
removeBootShell();
window.setTimeout(removeBootShell, 0);
window.setTimeout(removeBootShell, 1500);
</script>

<style>
/*
 * ion-router-outlet is position:absolute; inset:0 inside ion-app.
 * Keep the DEVO banner as a flex sibling *above* ion-app so it reserves
 * height instead of covering AppTopToolbar / community tabs.
 */
.app-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
}

.app-shell > ion-app {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  height: auto;
}

/* Expanded banner owns the top safe-area; avoid double padding on ion-header. */
.app-shell:has(> .devo-debug-banner) {
  --ion-safe-area-top: 0px;
}

#app {
  width: 100%;
  height: 100%;
}
</style>
