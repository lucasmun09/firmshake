<template>
  <div
    class="message-bubble-skeleton"
    :class="{ mine: align === 'right' }"
  >
    <div class="bubble breathing" />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    align?: 'left' | 'right';
  }>(),
  {
    align: 'left',
  },
);
</script>

<style scoped>
.message-bubble-skeleton {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 0.75rem;
}

.message-bubble-skeleton.mine {
  justify-content: flex-end;
}

.bubble {
  width: min(65%, 240px);
  height: 52px;
  border-radius: 16px;
}

.message-bubble-skeleton.mine .bubble {
  border-radius: 16px 16px 4px 16px;
}

.message-bubble-skeleton:not(.mine) .bubble {
  border-radius: 16px 16px 16px 4px;
}

@keyframes breathe {
  0%,
  100% {
    opacity: 0.35;
  }

  50% {
    opacity: 0.75;
  }
}

.breathing {
  animation: breathe 1.6s ease-in-out infinite;
  background: var(--ion-color-step-150);
}
</style>
