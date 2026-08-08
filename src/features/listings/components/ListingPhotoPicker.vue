<template>
  <div class="photo-picker">
    <div class="photo-actions">
      <ion-button fill="outline" type="button" :disabled="atLimit || busy" @click="handleUpload">
        Upload photos
      </ion-button>
      <ion-button fill="outline" type="button" :disabled="atLimit || busy" @click="handleTakePhoto">
        Take photo
      </ion-button>
      <input
        ref="fileInputRef"
        class="hidden-input"
        type="file"
        accept="image/*"
        :multiple="allowMultiple"
        @change="onFileChange"
      />
      <input
        ref="cameraInputRef"
        class="hidden-input"
        type="file"
        accept="image/*"
        capture="environment"
        @change="onFileChange"
      />
    </div>

    <p class="hint">
      Add {{ MIN_LISTING_PHOTOS }}–{{ MAX_LISTING_PHOTOS }} photos. At least one photo is required.
    </p>
    <p v-if="showApiUnavailableHint" class="api-hint">
      {{ apiUnavailableMessage }}
    </p>
    <p v-if="busy" class="busy-label">Processing photos…</p>
    <p v-if="atLimit" class="limit-label">Maximum of {{ MAX_LISTING_PHOTOS }} photos reached.</p>

    <div v-if="photos.length > 0" class="photo-grid">
      <div v-for="(photo, index) in photos" :key="photo.key" class="photo-card">
        <AuthenticatedImage :src="photo.previewUrl" :alt="`Listing photo ${index + 1}`" />
        <ion-button
          fill="clear"
          color="danger"
          size="small"
          class="remove-btn"
          type="button"
          @click="removePhoto(photo.key)"
        >
          Remove
        </ion-button>
      </div>
    </div>

    <WebcamCaptureModal
      :is-open="webcamOpen"
      @close="webcamOpen = false"
      @captured="(file) => addFiles([file])"
    />
  </div>
</template>

<script setup lang="ts">
import { Capacitor } from '@capacitor/core';
import { computed, onUnmounted, ref } from 'vue';
import { IonButton, toastController } from '@ionic/vue';

import WebcamCaptureModal from '@/components/WebcamCaptureModal.vue';
import AuthenticatedImage from '@/components/AuthenticatedImage.vue';
import { MAX_LISTING_PHOTOS, MIN_LISTING_PHOTOS } from '@/features/listings/constants/listingPhotos';
import type { ListingPhotoItem } from '@/features/listings/types/listingPhotos';
import { getApiUnavailableMessage } from '@/utils/apiBaseUrl';
import {
  compressListingPhotos,
  pickListingPhotoFromLibrary,
  takeListingPhoto,
} from '@/utils/photos';
import { isWebcamAvailable } from '@/utils/webcam';

const props = defineProps<{
  modelValue: ListingPhotoItem[];
  apiHealthy: boolean;
  /** When true, health check is in progress — hide the unavailable hint. */
  apiChecking?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [photos: ListingPhotoItem[]];
}>();

const isNative = Capacitor.isNativePlatform();
const fileInputRef = ref<HTMLInputElement | null>(null);
const cameraInputRef = ref<HTMLInputElement | null>(null);
const webcamOpen = ref(false);
const busy = ref(false);
const apiUnavailableMessage = getApiUnavailableMessage();

const photos = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const atLimit = computed(() => photos.value.length >= MAX_LISTING_PHOTOS);
const allowMultiple = computed(() => !isNative);
const showApiUnavailableHint = computed(
  () => !props.apiHealthy && !props.apiChecking,
);

onUnmounted(() => {
  revokeBlobPreviews(photos.value);
});

function revokeBlobPreviews(items: ListingPhotoItem[]) {
  for (const photo of items) {
    if (photo.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(photo.previewUrl);
    }
  }
}

function createKey(): string {
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function appendPhotos(items: ListingPhotoItem[]) {
  const remaining = MAX_LISTING_PHOTOS - photos.value.length;
  photos.value = [...photos.value, ...items.slice(0, remaining)];
}

async function addFiles(files: File[]) {
  if (files.length === 0) {
    return;
  }

  busy.value = true;
  try {
    const compressed = await compressListingPhotos(files);
    appendPhotos(
      compressed.map((file) => ({
        key: createKey(),
        previewUrl: URL.createObjectURL(file),
        file,
      })),
    );
  } finally {
    busy.value = false;
  }
}

function handleUpload() {
  if (isNative) {
    void pickFromNativeLibrary();
    return;
  }

  fileInputRef.value?.click();
}

async function pickFromNativeLibrary() {
  busy.value = true;
  try {
    const file = await pickListingPhotoFromLibrary();
    if (file) {
      await addFiles([file]);
    }
  } catch {
    await showError('Could not open photo library');
  } finally {
    busy.value = false;
  }
}

async function handleTakePhoto() {
  if (isNative) {
    busy.value = true;
    try {
      const file = await takeListingPhoto();
      if (file) {
        await addFiles([file]);
      }
    } catch {
      await showError('Could not access camera');
    } finally {
      busy.value = false;
    }
    return;
  }

  if (isWebcamAvailable()) {
    webcamOpen.value = true;
    return;
  }

  cameraInputRef.value?.click();
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  await addFiles(files);
}

function removePhoto(key: string) {
  const next = photos.value.filter((photo) => photo.key !== key);
  const removed = photos.value.find((photo) => photo.key === key);
  if (removed?.previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(removed.previewUrl);
  }
  photos.value = next;
}

async function showError(message: string) {
  const toast = await toastController.create({
    message,
    duration: 2500,
    color: 'danger',
  });
  await toast.present();
}
</script>

<style scoped>
.photo-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 1rem 0 0.5rem;
}

.hidden-input {
  display: none;
}

.hint,
.busy-label,
.limit-label {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
  margin: 0.25rem 0;
}

.api-hint {
  color: var(--ion-color-warning-shade);
  font-size: 0.9rem;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
}

.photo-card {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: var(--ion-color-step-100);
}

.photo-card :deep(img) {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
}

.remove-btn {
  width: 100%;
  margin: 0;
}
</style>
