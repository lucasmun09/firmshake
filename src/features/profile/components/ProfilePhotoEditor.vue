<template>
  <div class="profile-photo-editor">
    <UserAvatar
      :name="displayName"
      :photo-url="previewUrl"
      size="lg"
    />

    <div class="photo-actions">
      <ion-button fill="outline" type="button" :disabled="busy" @click="handleUpload">
        Upload photo
      </ion-button>
      <ion-button fill="outline" type="button" :disabled="busy" @click="handleTakePhoto">
        Take photo
      </ion-button>
    </div>

    <input
      ref="fileInputRef"
      class="hidden-input"
      type="file"
      accept="image/*"
      @change="onFileChange"
    />
    <input
      ref="cameraInputRef"
      class="hidden-input"
      type="file"
      accept="image/*"
      capture="user"
      @change="onFileChange"
    />

    <p v-if="!apiHealthy" class="hint">
      {{ apiUnavailableMessage }}
    </p>
    <p v-if="busy" class="hint">Uploading photo…</p>

    <WebcamCaptureModal
      :is-open="webcamOpen"
      @close="webcamOpen = false"
      @captured="uploadFile"
    />
  </div>
</template>

<script setup lang="ts">
import { Capacitor } from '@capacitor/core';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { IonButton, toastController } from '@ionic/vue';

import UserAvatar from '@/components/UserAvatar.vue';
import WebcamCaptureModal from '@/components/WebcamCaptureModal.vue';
import { checkApiHealth, getApiUnavailableMessage, uploadImage } from '@/common/services/api';
import { currentUser } from '@/features/auth/services/auth';
import { subscribeUserProfile, updateUserPhotoUrl } from '@/common/services/users';
import { compressListingPhoto } from '@/utils/imageProcessing';
import {
  pickListingPhotoFromLibrary,
  takeListingPhoto,
} from '@/utils/photos';
import { isWebcamAvailable } from '@/utils/webcam';

const props = defineProps<{
  communityIds: string[];
}>();

const isNative = Capacitor.isNativePlatform();
const fileInputRef = ref<HTMLInputElement | null>(null);
const cameraInputRef = ref<HTMLInputElement | null>(null);
const webcamOpen = ref(false);
const busy = ref(false);
const apiHealthy = ref(false);
const apiUnavailableMessage = getApiUnavailableMessage();
const displayName = ref('');
const photoUrl = ref('');

let unsubscribeProfile: (() => void) | undefined;

const previewUrl = computed(() => photoUrl.value);

onMounted(async () => {
  apiHealthy.value = await checkApiHealth();

  const user = currentUser.value;
  if (!user) {
    return;
  }

  unsubscribeProfile = subscribeUserProfile(user.uid, (profile) => {
    displayName.value = profile?.displayName ?? user.displayName ?? 'FirmShake User';
    photoUrl.value = profile?.photoUrl ?? '';
  });
});

onUnmounted(() => {
  unsubscribeProfile?.();
});

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
      await uploadFile(file);
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
        await uploadFile(file);
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
  const file = Array.from(input.files ?? [])[0];
  input.value = '';
  if (file) {
    await uploadFile(file);
  }
}

async function uploadFile(file: File) {
  const user = currentUser.value;
  if (!user) {
    return;
  }

  busy.value = true;
  try {
    apiHealthy.value = await checkApiHealth();
    if (!apiHealthy.value) {
      throw new Error(apiUnavailableMessage);
    }

    const compressed = await compressListingPhoto(file);
    const url = await uploadImage(compressed, props.communityIds);
    await updateUserPhotoUrl(user.uid, url);
    photoUrl.value = url;

    const toast = await toastController.create({
      message: 'Profile photo updated!',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
  } catch (error) {
    await showError(error instanceof Error ? error.message : 'Could not upload photo');
  } finally {
    busy.value = false;
  }
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
.profile-photo-editor {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.photo-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

.hidden-input {
  display: none;
}

.hint {
  margin: 0;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
  text-align: center;
}
</style>
