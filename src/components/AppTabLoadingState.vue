<template>
  <div class="loading-state">
    <ion-spinner name="crescent" />
    <p>{{ label }}</p>
  </div>
</template>

<script setup lang="ts">
import { IonSpinner } from '@ionic/vue';

withDefaults(
  defineProps<{
    label?: string;
  }>(),
  {
    label: 'Loading...',
  },
);
</script>

<style scoped>
.loading-state {
  padding: 2rem;
  text-align: center;
  color: var(--ion-color-medium);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
</style>
