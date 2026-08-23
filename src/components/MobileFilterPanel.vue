<template>
  <div class="mobile-filter-panel">
    <header class="mobile-filter-panel__header">
      <button type="button" class="mobile-filter-panel__back" @click="emit('back')">
        <ion-icon :icon="chevronBackOutline" aria-hidden="true" />
        <span>Back</span>
      </button>
      <h2 class="mobile-filter-panel__title">{{ title }}</h2>
    </header>
    <div class="mobile-filter-panel__body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { chevronBackOutline } from 'ionicons/icons';

defineProps<{
  title: string;
}>();

const emit = defineEmits<{
  back: [];
}>();
</script>

<style scoped>
.mobile-filter-panel__header {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0 0 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--ion-color-step-150);
}

.mobile-filter-panel__back {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  margin: 0;
  padding: 0.35rem 0.45rem 0.35rem 0;
  border: none;
  background: transparent;
  color: var(--ion-color-primary, #3880ff);
  font-size: 0.92rem;
  line-height: 1.2;
  cursor: pointer;
}

.mobile-filter-panel__back:focus-visible {
  outline: 2px solid var(--fs-focus-outline-color);
  outline-offset: 2px;
}

.mobile-filter-panel__title {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--ion-text-color);
}

.mobile-filter-panel__body {
  min-height: 0;
  padding-inline: var(--fs-sidebar-inset);
  padding-bottom: var(--fs-space-md);
}
</style>
