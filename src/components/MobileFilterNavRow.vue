<template>
  <button
    type="button"
    class="mobile-filter-nav-row"
    :aria-label="ariaLabel ?? value"
    @click="emit('click')"
  >
    <span class="mobile-filter-nav-row__value">{{ value }}</span>
    <ion-icon :icon="chevronForwardOutline" class="mobile-filter-nav-row__chevron" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { chevronForwardOutline } from 'ionicons/icons';

defineProps<{
  value: string;
  ariaLabel?: string;
}>();

const emit = defineEmits<{
  click: [];
}>();
</script>

<style scoped>
.mobile-filter-nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin: 0;
  padding: 0.55rem 0;
  border: none;
  border-bottom: 1px solid var(--ion-color-step-150, rgba(255, 255, 255, 0.12));
  background: transparent;
  color: var(--ion-text-color, #fff);
  font-size: 0.92rem;
  line-height: 1.35;
  text-align: left;
  cursor: pointer;
}

.mobile-filter-nav-row:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.85);
  outline-offset: 2px;
}

.mobile-filter-nav-row__value {
  flex: 1;
  min-width: 0;
}

.mobile-filter-nav-row__chevron {
  flex-shrink: 0;
  font-size: 1.1rem;
  color: var(--ion-color-medium);
}
</style>
