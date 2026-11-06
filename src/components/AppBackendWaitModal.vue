<template>
  <ion-modal
    :is-open="isOpen"
    :backdrop-dismiss="false"
    class="backend-wait-modal"
  >
    <div class="backend-wait-content">
      <ion-spinner name="crescent" />
      <p>{{ message }}</p>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { IonModal, IonSpinner } from '@ionic/vue';

withDefaults(
  defineProps<{
    isOpen: boolean;
    message?: string;
  }>(),
  {
    message: 'Connecting to FirmShake…',
  },
);
</script>

<style scoped>
.backend-wait-modal {
  --width: fit-content;
  --min-width: 240px;
  --height: fit-content;
  --border-radius: 12px;
}

.backend-wait-content {
  padding: 1.75rem 2rem;
  text-align: center;
  color: var(--ion-color-medium);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.backend-wait-content p {
  margin: 0;
  font-size: 0.95rem;
}
</style>
