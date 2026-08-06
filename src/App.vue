<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import router from '@/router';

function removeBootShell() {
  document.getElementById('app-boot-shell')?.remove();
}

void router.isReady().then(removeBootShell);
</script>
