<template>
  <ion-select
    :value="modelValue"
    :interface="selectInterface"
    class="view-select"
    aria-label="Browse view"
    @ionChange="onChange"
  >
    <ion-select-option
      v-for="option in options"
      :key="option.value"
      :value="option.value"
    >
      {{ option.label }}
    </ion-select-option>
  </ion-select>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonSelect, IonSelectOption } from '@ionic/vue';

import { useIonSelectInterface } from '@/common/composables/useIonSelectInterface';
import {
  browseViewOptions,
  type BrowseViewMode,
} from '@/features/listings/types/browseViewMode';

const { selectInterface } = useIonSelectInterface();

const props = defineProps<{
  modelValue: BrowseViewMode;
  showMap?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: BrowseViewMode];
}>();

const options = computed(() => browseViewOptions(props.showMap ?? false));

function onChange(event: CustomEvent) {
  const value = event.detail.value as BrowseViewMode;
  if (value !== props.modelValue) {
    emit('update:modelValue', value);
  }
}
</script>

<style scoped>
.view-select {
  width: 100%;
  max-width: 100%;
  --padding-start: 0;
  --padding-end: 0;
  font-size: 0.92rem;
}
</style>
