<template>
  <div
    class="refresh-indicator"
    :class="{ 'refresh-indicator--visible': show }"
    :aria-hidden="!show"
    aria-live="polite"
  >
    <ion-spinner name="circular" />
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue';
import { IonSpinner } from '@ionic/vue';

import {
  LOADING_SPINNER_MIN_DISPLAY_MS,
  useDebouncedVisibility,
} from '@/common/composables/useDebouncedVisibility';

const props = withDefaults(
  defineProps<{
    active?: boolean;
    delayMs?: number;
    minDisplayMs?: number;
  }>(),
  {
    active: false,
    delayMs: 300,
    minDisplayMs: LOADING_SPINNER_MIN_DISPLAY_MS,
  },
);

const show = useDebouncedVisibility(toRef(props, 'active'), {
  delayMs: props.delayMs,
  minDisplayMs: props.minDisplayMs,
});
</script>

<style scoped>
.refresh-indicator {
  position: absolute;
  top: 0.45rem;
  left: 50%;
  z-index: 2;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.125rem;
  height: 1.125rem;
  opacity: 0;
  pointer-events: none;
  transition: opacity 150ms ease;
}

.refresh-indicator--visible {
  opacity: 1;
}

.refresh-indicator ion-spinner {
  width: 1.125rem;
  height: 1.125rem;
  --color: var(--fs-toolbar-contrast);
}
</style>
