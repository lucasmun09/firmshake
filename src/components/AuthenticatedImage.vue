<script setup lang="ts">
import { ref, watch } from 'vue';

import { resolveAuthenticatedImageUrl } from '@/common/services/images';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    src: string;
    alt: string;
  }>(),
  {
    src: '',
    alt: '',
  },
);

const displayUrl = ref('');

watch(
  () => props.src,
  async (src) => {
    if (!src) {
      displayUrl.value = '';
      return;
    }

    try {
      displayUrl.value = await resolveAuthenticatedImageUrl(src);
    } catch {
      displayUrl.value = '';
    }
  },
  { immediate: true },
);
</script>

<template>
  <img v-if="displayUrl" v-bind="$attrs" :src="displayUrl" :alt="alt" />
</template>
