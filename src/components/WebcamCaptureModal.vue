<template>
  <ion-modal :is-open="isOpen" @didDismiss="$emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-title>Take photo</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="$emit('close')">Cancel</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="camera-wrap">
        <video ref="videoRef" playsinline muted class="camera-video" />
      </div>
      <ion-button expand="block" :disabled="!ready || capturing" @click="handleCapture">
        {{ capturing ? 'Saving...' : 'Capture photo' }}
      </ion-button>
      <p v-if="error" class="error">{{ error }}</p>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';

import { compressListingPhoto } from '@/utils/imageProcessing';
import { startWebcamCapture, type WebcamCapture } from '@/utils/webcam';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
  captured: [file: File];
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const ready = ref(false);
const capturing = ref(false);
const error = ref('');

let captureSession: WebcamCapture | undefined;

watch(
  () => props.isOpen,
  async (open) => {
    if (!open) {
      captureSession?.stop();
      captureSession = undefined;
      ready.value = false;
      error.value = '';
      return;
    }

    await nextTick();

    const video = videoRef.value;
    if (!video) {
      error.value = 'Camera preview is unavailable.';
      return;
    }

    try {
      captureSession = await startWebcamCapture(video);
      ready.value = true;
    } catch {
      error.value = 'Could not access your camera. Check browser permissions.';
    }
  },
);

async function handleCapture() {
  if (!captureSession) {
    return;
  }

  capturing.value = true;
  error.value = '';

  try {
    const raw = await captureSession.capture();
    const compressed = await compressListingPhoto(raw);
    emit('captured', compressed);
    emit('close');
  } catch {
    error.value = 'Could not capture photo.';
  } finally {
    capturing.value = false;
  }
}
</script>

<style scoped>
.camera-wrap {
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.camera-video {
  width: 100%;
  max-height: 60vh;
  object-fit: cover;
  display: block;
}

.error {
  color: var(--ion-color-danger);
  margin-top: 0.75rem;
}
</style>
