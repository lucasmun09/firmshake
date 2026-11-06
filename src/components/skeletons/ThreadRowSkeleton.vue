<template>
  <ion-item class="thread-row-skeleton" lines="full">
    <div slot="start" class="thumb-skeleton breathing" />
    <ion-label>
      <div class="line title-line breathing" />
      <div class="line subtitle-line breathing" />
      <div class="line preview-line breathing" />
    </ion-label>
  </ion-item>
</template>

<script setup lang="ts">
import { IonItem, IonLabel } from '@ionic/vue';
</script>

<style scoped>
.thread-row-skeleton {
  --padding-start: 16px;
  --inner-padding-end: 16px;
}

.thumb-skeleton {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  flex-shrink: 0;
}

.line {
  height: 12px;
  border-radius: 6px;
  margin-bottom: 8px;
}

.title-line {
  width: 68%;
}

.subtitle-line {
  width: 45%;
}

.preview-line {
  width: 85%;
  margin-bottom: 0;
}

@keyframes breathe {
  0%,
  100% {
    opacity: 0.35;
  }

  50% {
    opacity: 0.75;
  }
}

.breathing {
  animation: breathe 1.6s ease-in-out infinite;
  background: var(--ion-color-step-150);
}
</style>
