<template>
  <ion-page>
    <AppTopToolbar title="Saved" />

    <ion-content class="app-tab-content">
      <AppContentFrame>
        <div v-if="entries.length === 0" class="empty-state">
          <p>No saved listings yet.</p>
          <ion-note>Double-tap a browse card or tap the bookmark icon to save a listing.</ion-note>
          <ion-button router-link="/tabs/home" fill="outline" class="browse-cta">Browse listings</ion-button>
        </div>

        <ion-list v-else>
          <ion-item
            v-for="entry in entries"
            :key="entry.id"
            button
            :router-link="listingDetailPath(entry.id)"
            detail
          >
            <ion-thumbnail slot="start">
              <AuthenticatedImage
                :src="entry.imageUrl"
                :alt="entry.title"
                variant="thumbnail"
              />
            </ion-thumbnail>
            <ion-label>
              <h2>{{ entry.title }}</h2>
              <p>{{ formatPrice(entry.price) }}</p>
              <p class="saved-at">Saved {{ formatRelativeTime(entry.savedAt) }}</p>
            </ion-label>
            <ListingBookmarkButton
              slot="end"
              :saved="true"
              @toggle="onUnsave(entry.id, entry)"
            />
          </ion-item>
        </ion-list>
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonContent,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonThumbnail,
} from '@ionic/vue';

import AppContentFrame from '@/components/AppContentFrame.vue';
import AppTopToolbar from '@/components/AppTopToolbar.vue';
import AuthenticatedImage from '@/components/AuthenticatedImage.vue';
import ListingBookmarkButton from '@/features/listings/components/ListingBookmarkButton.vue';
import { useListingBookmark, useSavedListingsEntries } from '@/features/listings/composables/useListingBookmark';
import { listingDetailPath } from '@/features/listings/utils/browseMapView';
import type { SavedListingEntry } from '@/features/listings/services/savedListings';
import { formatRelativeTime } from '@/common/utils/formatRelativeTime';
import { formatPrice } from '@/utils/currency';

const { entries } = useSavedListingsEntries();
const { toggleBookmark } = useListingBookmark(() => '');

async function onUnsave(listingId: string, entry: SavedListingEntry) {
  await toggleBookmark({
    id: listingId,
    title: entry.title,
    price: entry.price,
    imageUrl: entry.imageUrl,
    status: 'active',
    sellerId: '',
    communityIds: [],
    primaryCategoryId: '',
  });
}
</script>

<style scoped>
.empty-state {
  text-align: center;
  padding: var(--fs-space-xl) var(--fs-space-md);
}

.browse-cta {
  margin-top: var(--fs-space-md);
}

.saved-at {
  color: var(--ion-color-medium, #92949c);
  font-size: 0.85rem;
}
</style>
