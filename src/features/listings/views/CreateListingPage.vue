<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button :default-href="backHref" />
        </ion-buttons>
        <ion-title>{{ isEditing ? 'Edit listing' : 'Sell on FirmShake' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <AppContentFrame>
        <div v-if="loadingListing" class="loading-state">
          <ion-spinner name="crescent" />
          <p>Loading listing...</p>
        </div>

        <form v-else @submit.prevent="handleSubmit">
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
              v-model="primaryCategoryId"
              label="Category"
              label-placement="stacked"
              interface="popover"
            >
              <ion-select-option
                v-for="category in topLevelCategories"
                :key="category.id"
                :value="category.id"
              >
                {{ category.name }}
              </ion-select-option>
            </ion-select>
          </ion-item>

          <ion-item>
            <ion-input
              v-model="locationLabel"
              label="Location (optional)"
              label-placement="stacked"
              placeholder="City or neighborhood"
            />
          </ion-item>
          <p class="location-hint">
            Use current location so nearby buyers can find this listing with distance search.
          </p>

          <ion-item lines="none">
            <ion-button fill="outline" expand="block" type="button" @click="useCurrentLocation">
              Use current location
            </ion-button>
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

          <ListingPhotoPicker v-model="photos" :api-healthy="apiHealthy" />

          <ion-button
            expand="block"
            type="submit"
            :disabled="submitting || !canSubmit"
            class="submit-btn"
          >
            {{ submitLabel }}
          </ion-button>
        </form>
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { onIonViewWillEnter } from '@ionic/vue';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue';

import { ALL_COMMUNITY_ID } from '@/features/communities/data/seedCommunities';
import { getDefaultCategoryId } from '@/features/listings/data/seedCategories';
import AppContentFrame from '@/components/AppContentFrame.vue';
import ListingPhotoPicker from '@/features/listings/components/ListingPhotoPicker.vue';
import { MIN_LISTING_PHOTOS } from '@/features/listings/constants/listingPhotos';
import { checkApiHealth, getApiUnavailableMessage } from '@/common/services/api';
import { fetchCategories } from '@/features/listings/services/categories';
import {
  bootstrapCommunities,
  bootstrapProfile,
  waitForBootstrap,
} from '@/common/services/appBootstrap';
import { createListing, getListingById, updateListing } from '@/features/listings/services/listings';
import { currentUser } from '@/features/auth/services/auth';
import type { Category } from '@/types';
import type { ListingPhotoItem } from '@/features/listings/types/listingPhotos';
import { encodeGeohash } from '@/features/listings/utils/geohash';
import {
  forwardGeocodeAddress,
  isGoogleMapsConfigured,
  reverseGeocodeCityRegion,
} from '@/utils/googleMaps';
import {
  photosFromListing,
  resolveListingImageUrls,
  validateListingPhotos,
} from '@/features/listings/utils/listingPhotoUpload';

const router = useRouter();
const route = useRoute();

const listingId = computed(() =>
  typeof route.params.id === 'string' ? route.params.id : '',
);
const isEditing = computed(() => route.name === 'EditListing' && Boolean(listingId.value));

const backHref = computed(() =>
  isEditing.value ? `/listing/${listingId.value}` : '/tabs/home',
);

const title = ref('');
const description = ref('');
const price = ref(0);
const primaryCategoryId = ref(getDefaultCategoryId());
const locationLabel = ref('');
const locationCity = ref('');
const locationRegion = ref('');
const locationCoords = ref<{ lat: number; lng: number } | null>(null);
const categories = ref<Category[]>([]);
const selectedCommunities = ref<string[]>([ALL_COMMUNITY_ID]);
const photos = ref<ListingPhotoItem[]>([]);
const submitting = ref(false);
const loadingListing = ref(false);
const communities = bootstrapCommunities;
const profile = bootstrapProfile;
const apiHealthy = ref(false);

const postableCommunities = computed(() => {
  const joinedIds = new Set(profile.value?.communityIds ?? [ALL_COMMUNITY_ID]);
  return communities.value.filter((community) => joinedIds.has(community.id));
});

const topLevelCategories = computed(() =>
  categories.value.filter((category) => !category.parentId),
);

const canSubmit = computed(() => {
  return (
    title.value.trim().length > 0 &&
    description.value.trim().length > 0 &&
    photos.value.length >= MIN_LISTING_PHOTOS &&
    apiHealthy.value
  );
});

const submitLabel = computed(() => {
  if (submitting.value) {
    return isEditing.value ? 'Saving...' : 'Posting...';
  }

  return isEditing.value ? 'Save changes' : 'Post listing';
});

onMounted(async () => {
  await refreshPageData();
});

onIonViewWillEnter(() => {
  void refreshPageData().then(() => {
    applyCommunityFromRoute();
    if (isEditing.value) {
      void loadListingForEdit();
    }
  });
});

function applyCommunityFromRoute() {
  if (isEditing.value) {
    return;
  }

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
  await waitForBootstrap();
  categories.value = await fetchCategories();
}

async function useCurrentLocation() {
  if (!navigator.geolocation) {
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      locationCoords.value = coords;

      if (isGoogleMapsConfigured()) {
        void reverseGeocodeCityRegion(coords.lat, coords.lng)
          .then(({ city, region }) => {
            locationCity.value = city ?? '';
            locationRegion.value = region ?? '';
            if (!locationLabel.value.trim() && city) {
              locationLabel.value = region ? `${city}, ${region}` : city;
            }
          })
          .catch(() => undefined);
      }

      if (!locationLabel.value.trim()) {
        locationLabel.value = 'Current location';
      }
    },
    () => undefined,
    { enableHighAccuracy: false, timeout: 10000 },
  );
}

async function listingLocationPayload() {
  if (locationCoords.value) {
    return {
      lat: locationCoords.value.lat,
      lng: locationCoords.value.lng,
      geohash: encodeGeohash(locationCoords.value),
      city: locationCity.value.trim() || undefined,
      region: locationRegion.value.trim() || undefined,
      label: locationLabel.value.trim() || undefined,
    };
  }

  const label = locationLabel.value.trim();
  if (!label || !isGoogleMapsConfigured()) {
    return undefined;
  }

  try {
    const geocoded = await forwardGeocodeAddress(label);
    locationCoords.value = { lat: geocoded.lat, lng: geocoded.lng };
    locationCity.value = geocoded.city ?? locationCity.value;
    locationRegion.value = geocoded.region ?? locationRegion.value;

    return {
      lat: geocoded.lat,
      lng: geocoded.lng,
      geohash: encodeGeohash({ lat: geocoded.lat, lng: geocoded.lng }),
      city: geocoded.city,
      region: geocoded.region,
      label,
    };
  } catch {
    return undefined;
  }
}

async function loadListingForEdit() {
  const user = currentUser.value;
  if (!user || !listingId.value) {
    return;
  }

  loadingListing.value = true;

  try {
    const listing = await getListingById(listingId.value);
    if (!listing) {
      throw new Error('Listing not found');
    }

    if (listing.sellerId !== user.uid) {
      throw new Error('You can only edit your own listings');
    }

    if (listing.status !== 'active') {
      throw new Error('Delisted listings cannot be edited');
    }

    title.value = listing.title;
    description.value = listing.description;
    price.value = listing.price;
    primaryCategoryId.value = listing.primaryCategoryId;
    locationLabel.value = listing.location?.label ?? '';
    locationCity.value = listing.location?.city ?? '';
    locationRegion.value = listing.location?.region ?? '';
    locationCoords.value = listing.location
      ? { lat: listing.location.lat, lng: listing.location.lng }
      : null;
    selectedCommunities.value = listing.communityIds;
    photos.value = photosFromListing(listing.imageUrls);
  } catch (error) {
    const toast = await toastController.create({
      message: error instanceof Error ? error.message : 'Could not load listing',
      duration: 2500,
      color: 'danger',
    });
    await toast.present();
    void router.replace('/tabs/selling');
  } finally {
    loadingListing.value = false;
  }
}

async function handleSubmit() {
  if (!title.value.trim() || !description.value.trim()) {
    return;
  }

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
    if (!apiHealthy.value) {
      throw new Error(getApiUnavailableMessage());
    }

    validateListingPhotos(photos.value);

    const communityIds =
      selectedCommunities.value.length > 0 ? selectedCommunities.value : [ALL_COMMUNITY_ID];
    const imageUrls = await resolveListingImageUrls(photos.value, communityIds);

    if (isEditing.value && listingId.value) {
      await updateListing(listingId.value, {
        title: title.value.trim(),
        description: description.value.trim(),
        price: price.value,
        imageUrls,
        communityIds,
        primaryCategoryId: primaryCategoryId.value,
        categoryIds: [primaryCategoryId.value],
        location: await listingLocationPayload(),
      });

      const toast = await toastController.create({
        message: 'Listing updated!',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
      void router.replace(`/listing/${listingId.value}`);
      return;
    }

    const listing = await createListing({
      title: title.value.trim(),
      description: description.value.trim(),
      price: price.value,
      imageUrls,
      sellerId: user.uid,
      sellerName: user.displayName ?? 'FirmShake User',
      communityIds,
      primaryCategoryId: primaryCategoryId.value,
      categoryIds: [primaryCategoryId.value],
      location: await listingLocationPayload(),
    });

    const toast = await toastController.create({
      message: 'Listing posted!',
      duration: 2000,
      color: 'success',
    });
    await toast.present();

    void router.replace(`/listing/${listing.id}`);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not save listing. Try again.';
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
.loading-state {
  padding: 2rem;
  text-align: center;
  color: var(--ion-color-medium);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.location-hint {
  margin: 0 0 0.5rem 1rem;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  line-height: 1.35;
}

.submit-btn {
  margin-top: 1.5rem;
}
</style>
