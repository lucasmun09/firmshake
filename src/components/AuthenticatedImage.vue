<script setup lang="ts">
import { ref, watch } from 'vue';

import {
  resolveAuthenticatedImageUrl,
  resolveAuthenticatedThumbnailUrl,
} from '@/common/services/images';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    src: string;
    alt: string;
    /** Use cached low-res thumbnail for browse rows/cards. */
    variant?: 'full' | 'thumbnail';
  }>(),
  {
    src: '',
    alt: '',
    variant: 'full',
  },
);

const displayUrl = ref('');

watch(
  [() => props.src, () => props.variant],
  async ([src, variant]) => {
    if (!src) {
      displayUrl.value = '';
      return;
    }

    try {
      displayUrl.value =
        variant === 'thumbnail'
          ? await resolveAuthenticatedThumbnailUrl(src)
          : await resolveAuthenticatedImageUrl(src);
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
