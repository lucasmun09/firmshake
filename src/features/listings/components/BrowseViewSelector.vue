<template>
  <div class="browse-view-selector" role="radiogroup" aria-label="Browse view">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="browse-view-option"
      :class="{ 'browse-view-option--selected': modelValue === option.value }"
      role="radio"
      :aria-checked="modelValue === option.value"
      @click="select(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import {
  browseViewOptions,
  type BrowseViewMode,
} from '@/features/listings/types/browseViewMode';

const props = defineProps<{
  modelValue: BrowseViewMode;
  showMap?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: BrowseViewMode];
}>();

const options = computed(() => browseViewOptions(props.showMap ?? false));

function select(value: BrowseViewMode) {
  if (value !== props.modelValue) {
    emit('update:modelValue', value);
  }
}
</script>

<style scoped>
.browse-view-selector {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.browse-view-option {
  width: 100%;
  margin: 0;
  padding: 0.45rem 0.55rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--ion-text-color, #fff);
  font-size: 0.92rem;
  line-height: 1.35;
  text-align: left;
  cursor: pointer;
}

.browse-view-option:hover {
  background: var(--ion-color-step-50, rgba(255, 255, 255, 0.04));
}

.browse-view-option:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.85);
  outline-offset: 2px;
}

.browse-view-option--selected {
  border-color: rgba(var(--ion-color-primary-rgb, 56, 128, 255), 0.45);
  background: rgba(var(--ion-color-primary-rgb, 56, 128, 255), 0.12);
  font-weight: 600;
  color: var(--ion-color-primary, #3880ff);
}
</style>
