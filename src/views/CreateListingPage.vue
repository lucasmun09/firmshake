<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Sell on FirmShake</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <AppContentFrame>
      <form @submit.prevent="handleSubmit">
        <ion-item>
          <ion-input
            v-model="title"
            label="Title"
            label-placement="stacked"
            required
          />
        </ion-item>

        <ion-item>
          <ion-textarea
            v-model="description"
            label="Description"
            label-placement="stacked"
            :auto-grow="true"
            required
          />
        </ion-item>

        <ion-item>
          <ion-input
            v-model.number="price"
            type="number"
            label="Price (USD)"
            label-placement="stacked"
            min="0"
          />
        </ion-item>

        <ion-item>
          <ion-select
            v-model="selectedCommunities"
            label="Communities"
            label-placement="stacked"
            multiple
            interface="popover"
          >
            <ion-select-option
              v-for="community in postableCommunities"
              :key="community.id"
              :value="community.id"
            >
              {{ community.name }}
              <span v-if="community.type === 'admin'"> (admin)</span>
            </ion-select-option>
          </ion-select>
        </ion-item>

        <div class="photo-actions">
          <ion-button fill="outline" type="button" @click="handlePickPhoto">
            {{ isNative ? 'Take or choose photo' : 'Choose photo' }}
          </ion-button>
          <input
            ref="fileInput"
            class="hidden-input"
            type="file"
            accept="image/*"
            @change="onFileChange"
          />
        </div>

        <p v-if="!apiHealthy" class="api-hint">
          Photo uploads need firmshake-api running locally
          (<code>cd firmshake-api && python app.py</code>).
          Listings without a photo will use a placeholder.
        </p>

        <p v-if="showCompressing" class="compressing-label">Optimizing photo…</p>

        <p v-if="imagePreview" class="preview-label">Preview</p>
        <img v-if="imagePreview" :src="imagePreview" alt="Preview" class="preview-image" />

        <ion-button
          expand="block"
          type="submit"
          :disabled="submitting || compressingPhoto"
          class="submit-btn"
        >
          {{ submitting ? 'Posting...' : 'Post listing' }}
        </ion-button>
      </form>
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { Capacitor } from '@capacitor/core';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { onIonViewWillEnter } from '@ionic/vue';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue';

import { ALL_COMMUNITY_ID } from '@/data/seedCommunities';
import AppContentFrame from '@/components/AppContentFrame.vue';
import { checkApiHealth, uploadImage } from '@/services/api';
import { fetchCommunities } from '@/services/communities';
import { createListing } from '@/services/listings';
import { currentUser } from '@/services/auth';
import { subscribeUserProfile } from '@/services/users';
import type { Community, UserProfile } from '@/types';
import { compressListingPhoto } from '@/utils/imageProcessing';
import { pickListingPhoto } from '@/utils/photos';

const router = useRouter();
const route = useRoute();
const isNative = Capacitor.isNativePlatform();

const title = ref('');
const description = ref('');
const price = ref(0);
const selectedCommunities = ref<string[]>([ALL_COMMUNITY_ID]);
const imagePreview = ref('');
const selectedFile = ref<File | null>(null);
const submitting = ref(false);
const compressingPhoto = ref(false);
const showCompressing = ref(false);
const communities = ref<Community[]>([]);
const profile = ref<UserProfile | null>(null);
const apiHealthy = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

let unsubscribeProfile: (() => void) | undefined;

const postableCommunities = computed(() => {
  const joinedIds = new Set(profile.value?.communityIds ?? [ALL_COMMUNITY_ID]);
  return communities.value.filter((community) => joinedIds.has(community.id));
});

onMounted(async () => {
  await refreshPageData();

  const user = currentUser.value;
  if (user) {
    unsubscribeProfile = subscribeUserProfile(user.uid, (nextProfile) => {
      profile.value = nextProfile;
    });
  }
});

onIonViewWillEnter(() => {
  void refreshPageData().then(() => {
    applyCommunityFromRoute();
  });
});

function applyCommunityFromRoute() {
  const communityId = route.query.community;
  if (typeof communityId !== 'string' || !communityId) {
    return;
  }

  const canPost = postableCommunities.value.some((community) => community.id === communityId);
  if (canPost) {
    selectedCommunities.value = [communityId];
  }
}

async function refreshPageData() {
  apiHealthy.value = await checkApiHealth();
  communities.value = await fetchCommunities();
}

onUnmounted(() => {
  unsubscribeProfile?.();
});

async function setPhotoFile(file: File) {
  compressingPhoto.value = true;
  showCompressing.value = false;
  const loadingTimer = window.setTimeout(() => {
    showCompressing.value = true;
  }, 200);

  try {
    apiHealthy.value = await checkApiHealth();
    const compressed = await compressListingPhoto(file);
    if (imagePreview.value) {
      URL.revokeObjectURL(imagePreview.value);
    }
    selectedFile.value = compressed;
    imagePreview.value = URL.createObjectURL(compressed);
  } finally {
    window.clearTimeout(loadingTimer);
    compressingPhoto.value = false;
    showCompressing.value = false;
  }
}

async function handlePickPhoto() {
  if (isNative) {
    try {
      const file = await pickListingPhoto();
      if (file) setPhotoFile(file);
    } catch {
      const toast = await toastController.create({
        message: 'Could not access camera',
        duration: 2500,
        color: 'danger',
      });
      await toast.present();
    }
    return;
  }

  fileInput.value?.click();
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  setPhotoFile(file);
}

async function handleSubmit() {
  if (!title.value.trim() || !description.value.trim()) return;

  const user = currentUser.value;
  if (!user) {
    const toast = await toastController.create({
      message: 'You must be signed in to post a listing.',
      duration: 2500,
      color: 'warning',
    });
    await toast.present();
    return;
  }

  submitting.value = true;

  try {
    apiHealthy.value = await checkApiHealth();
    const communityIds =
      selectedCommunities.value.length > 0 ? selectedCommunities.value : [ALL_COMMUNITY_ID];
    let imageUrl = 'https://picsum.photos/seed/placeholder/400/300';

    if (selectedFile.value) {
      if (!apiHealthy.value) {
        throw new Error('Start firmshake-api before uploading a photo (python app.py)');
      }
      imageUrl = await uploadImage(selectedFile.value, communityIds);
    }

    const listing = await createListing({
      title: title.value.trim(),
      description: description.value.trim(),
      price: price.value,
      imageUrl,
      sellerId: user.uid,
      sellerName: user.displayName ?? 'FirmShake User',
      communityIds,
    });

    const toast = await toastController.create({
      message: 'Listing posted!',
      duration: 2000,
      color: 'success',
    });
    await toast.present();

    router.replace(`/listing/${listing.id}`);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not post listing. Try again.';
    const toast = await toastController.create({
      message,
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.photo-actions {
  margin: 1rem 0;
}

.hidden-input {
  display: none;
}

.api-hint {
  color: var(--ion-color-warning-shade);
  font-size: 0.9rem;
}

.compressing-label {
  margin: 0.75rem 0 0;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.preview-label {
  margin: 1rem 0 0.5rem;
  color: var(--ion-color-medium);
}

.preview-image {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: 8px;
}

.submit-btn {
  margin-top: 1.5rem;
}
</style>
