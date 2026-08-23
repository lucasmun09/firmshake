<template>
  <ion-page>
    <AppTopToolbar title="Recent Listings" show-back-button back-href="/tabs/home" />

    <ion-content>
      <AppContentFrame>
        <div v-if="entries.length === 0" class="empty-state">
          <p>No recent listings yet.</p>
          <ion-note>Browse listings and open a detail page to see them here.</ion-note>
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
              <p class="viewed-at">{{ formatViewedAt(entry.viewedAt) }}</p>
            </ion-label>
          </ion-item>
        </ion-list>
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
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
import { useRecentListingsEntries } from '@/features/listings/composables/useRecentListings';
import { listingDetailPath } from '@/features/listings/utils/browseMapView';
import { formatPrice } from '@/utils/currency';

const { entries } = useRecentListingsEntries();

function formatViewedAt(viewedAt: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(viewedAt));
}
</script>

<style scoped>
.empty-state {
  text-align: center;
  padding: var(--fs-space-xl) var(--fs-space-md);
}

.viewed-at {
  color: var(--ion-color-medium, #92949c);
  font-size: 0.85rem;
}
</style>
