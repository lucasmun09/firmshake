<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Sell on FirmShake</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
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
              v-for="community in selectableCommunities"
              :key="community.id"
              :value="community.id"
            >
              {{ community.name }}
              <span v-if="community.type === 'admin'"> (admin)</span>
            </ion-select-option>
          </ion-select>
        </ion-item>

        <ion-item>
          <ion-label>Photo</ion-label>
          <input type="file" accept="image/*" @change="onFileChange" />
        </ion-item>

        <p v-if="imagePreview" class="preview-label">Preview</p>
        <img v-if="imagePreview" :src="imagePreview" alt="Preview" class="preview-image" />

        <ion-button expand="block" type="submit" :disabled="submitting" class="submit-btn">
          {{ submitting ? 'Posting...' : 'Post listing' }}
        </ion-button>
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
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

import { mockCommunities } from '@/data/mockCommunities';
import { uploadImage } from '@/services/api';
import { addListing } from '@/services/listings';
import { currentUser } from '@/services/auth';

const router = useRouter();

const title = ref('');
const description = ref('');
const price = ref(0);
const selectedCommunities = ref<string[]>(['all']);
const imagePreview = ref('');
const selectedFile = ref<File | null>(null);
const submitting = ref(false);

const selectableCommunities = computed(() =>
  mockCommunities.filter((c) => c.id !== 'all' || selectedCommunities.value.includes('all')),
);

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  selectedFile.value = file;
  imagePreview.value = URL.createObjectURL(file);
}

async function handleSubmit() {
  if (!title.value.trim() || !description.value.trim()) return;

  submitting.value = true;

  try {
    let imageUrl = 'https://picsum.photos/seed/placeholder/400/300';

    if (selectedFile.value) {
      imageUrl = await uploadImage(selectedFile.value);
    }

    const communityIds =
      selectedCommunities.value.length > 0 ? selectedCommunities.value : ['all'];

    const listing = addListing({
      title: title.value.trim(),
      description: description.value.trim(),
      price: price.value,
      imageUrl,
      sellerName: currentUser.value?.displayName ?? 'You',
      communityIds,
    });

    const toast = await toastController.create({
      message: 'Listing posted!',
      duration: 2000,
      color: 'success',
    });
    await toast.present();

    router.replace(`/listing/${listing.id}`);
  } catch {
    const toast = await toastController.create({
      message: 'Could not post listing. Is the Flask server running?',
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
