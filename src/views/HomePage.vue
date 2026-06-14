<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>FirmShake</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment v-model="selectedCommunity" @ionChange="onCommunityChange">
          <ion-segment-button
            v-for="community in communities"
            :key="community.id"
            :value="community.id"
          >
            <ion-label>{{ community.name }}</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-list>
        <ion-item
          v-for="listing in listings"
          :key="listing.id"
          button
          :router-link="`/listing/${listing.id}`"
          detail
        >
          <ion-thumbnail slot="start">
            <img :src="listing.imageUrl" :alt="listing.title" />
          </ion-thumbnail>
          <ion-label>
            <h2>{{ listing.title }}</h2>
            <p>{{ formatPrice(listing.price) }} · {{ listing.sellerName }}</p>
            <p class="community-tags">{{ communityLabel(listing.communityIds) }}</p>
          </ion-label>
        </ion-item>
      </ion-list>

      <div v-if="listings.length === 0" class="empty-state">
        <p>No listings in this community yet.</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonThumbnail,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';

import { mockCommunities } from '@/data/mockCommunities';
import { getListings } from '@/services/listings';

const communities = mockCommunities;
const selectedCommunity = ref('all');

const listings = computed(() => getListings(selectedCommunity.value));

function onCommunityChange(event: CustomEvent) {
  selectedCommunity.value = event.detail.value;
}

function formatPrice(price: number): string {
  return price === 0 ? 'Free' : `$${price}`;
}

function communityLabel(communityIds: string[]): string {
  const names = communityIds
    .map((id) => communities.find((c) => c.id === id)?.name)
    .filter(Boolean);
  return names.join(', ');
}
</script>

<style scoped>
.community-tags {
  color: var(--ion-color-medium);
  font-size: 0.85rem;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--ion-color-medium);
}
</style>
