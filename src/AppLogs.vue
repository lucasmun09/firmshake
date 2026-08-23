<template>
  <ion-app class="logs-app">
    <ion-router-outlet :animated="false" />
  </ion-app>
</template>

<script setup lang="ts">
/**
 * Minimal shell for `/logs` (main-logs.ts). Must not import the full app router
 * or Firebase — those compete for IndexedDB and can leave the boot shell stuck.
 */
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { IonApp, IonRouterOutlet } from '@ionic/vue';

function removeBootShell() {
  document.getElementById('app-boot-shell')?.remove();
}

const router = useRouter();
void router.isReady().then(removeBootShell);
onMounted(removeBootShell);
</script>

<style>
/*
 * Ionic page enter transitions can leave the only route at opacity:0 on a cold
 * /logs boot (no prior page to transition from) — solid black in dark mode.
 */
.logs-app {
  background: var(--ion-background-color, #ffffff);
  color: var(--ion-text-color, #000000);
}

.logs-app ion-router-outlet > .ion-page,
.logs-app ion-router-outlet > .ion-page.ion-page-invisible {
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
  z-index: 1 !important;
}
</style>
