<template>
  <div
    class="user-avatar"
    :class="[`user-avatar--${size}`]"
    :aria-label="name || 'User'"
  >
    <AuthenticatedImage
      v-if="photoUrl"
      :src="photoUrl"
      :alt="name || 'Profile photo'"
      class="avatar-image"
    />
    <span v-else class="avatar-initials">{{ initials }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import AuthenticatedImage from '@/components/AuthenticatedImage.vue';

const props = withDefaults(
  defineProps<{
    name?: string;
    photoUrl?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
  }>(),
  {
    name: '',
    photoUrl: '',
    size: 'md',
  },
);

const initials = computed(() => {
  const parts = props.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
});
</script>

<style scoped>
.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  overflow: hidden;
  background: var(--ion-color-primary-shade);
  color: var(--ion-color-primary-contrast);
  font-weight: 600;
  flex-shrink: 0;
}

.user-avatar--xs {
  width: 28px;
  height: 28px;
  font-size: 0.65rem;
}

.user-avatar--sm {
  width: 32px;
  height: 32px;
  font-size: 0.75rem;
}

.user-avatar--md {
  width: 48px;
  height: 48px;
  font-size: 0.95rem;
}

.user-avatar--lg {
  width: 96px;
  height: 96px;
  font-size: 1.75rem;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-initials {
  line-height: 1;
}
</style>
