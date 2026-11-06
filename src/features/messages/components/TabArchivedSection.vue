<template>
  <div v-if="hasArchived" class="tab-archived-section">
    <div v-if="!expanded" class="tab-archived-toggle">
      <ion-button fill="clear" expand="block" @click="$emit('update:expanded', true)">
        See archived messages
      </ion-button>
    </div>
    <template v-else>
      <div class="tab-archived-divider" role="separator" />
      <h3 class="tab-archived-header">{{ headerLabel }}</h3>
      <slot />
    </template>
  </div>
</template>

<script setup lang="ts">
import { IonButton } from '@ionic/vue';

defineProps<{
  hasArchived: boolean;
  headerLabel: string;
  expanded: boolean;
}>();

defineEmits<{
  'update:expanded': [value: boolean];
}>();
</script>

<style scoped>
.tab-archived-toggle {
  display: flex;
  justify-content: center;
  padding: 0.5rem 1rem 1.5rem;
}

.tab-archived-divider {
  height: 1px;
  margin: 0.5rem 1rem;
  background: var(--ion-color-light-shade);
}

.tab-archived-header {
  margin: 0.75rem 1rem 0.25rem;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--ion-color-medium);
}
</style>
