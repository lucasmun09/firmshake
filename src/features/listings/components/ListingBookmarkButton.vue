<template>
  <button
    type="button"
    class="listing-bookmark-button"
    :class="{ 'listing-bookmark-button--saved': saved }"
    :aria-label="saved ? 'Remove from saved listings' : 'Save listing'"
    :aria-pressed="saved"
    @click.stop.prevent="emit('toggle')"
  >
    <ion-icon :icon="saved ? bookmark : bookmarkOutline" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { bookmark, bookmarkOutline } from 'ionicons/icons';

defineProps<{
  saved: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();
</script>

<style scoped>
.listing-bookmark-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  cursor: pointer;
  backdrop-filter: blur(4px);
  transition: background 0.15s ease, transform 0.15s ease;
}

.listing-bookmark-button:hover,
.listing-bookmark-button:focus-visible {
  background: rgba(0, 0, 0, 0.72);
  transform: scale(1.04);
}

.listing-bookmark-button:focus-visible {
  outline: 2px solid var(--ion-color-primary, #3880ff);
  outline-offset: 2px;
}

.listing-bookmark-button--saved {
  color: var(--ion-color-warning, #ffc409);
}

.listing-bookmark-button ion-icon {
  font-size: 1.15rem;
}
</style>
