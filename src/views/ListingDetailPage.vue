<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/home" />
        </ion-buttons>
        <ion-title>Listing</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content v-if="listing">
      <img class="hero-image" :src="listing.imageUrl" :alt="listing.title" />

      <div class="details">
        <h1>{{ listing.title }}</h1>
        <p class="price">{{ formatPrice(listing.price) }}</p>
        <p class="seller">Seller: {{ listing.sellerName }}</p>
        <p class="description">{{ listing.description }}</p>

        <ion-chip v-for="name in communityNames" :key="name" color="primary" outline>
          {{ name }}
        </ion-chip>

        <ion-button expand="block" class="meetup-cta" disabled>
          Request binding meetup (coming soon)
        </ion-button>
      </div>
    </ion-content>

    <ion-content v-else>
      <div class="empty-state">
        <p>Listing not found.</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';

import { mockCommunities } from '@/data/mockCommunities';
import { getListingById } from '@/services/listings';

const route = useRoute();
const listing = computed(() => getListingById(route.params.id as string));

const communityNames = computed(() => {
  if (!listing.value) return [];
  return listing.value.communityIds
    .map((id) => mockCommunities.find((c) => c.id === id)?.name)
    .filter(Boolean) as string[];
});

function formatPrice(price: number): string {
  return price === 0 ? 'Free' : `$${price}`;
}
</script>

<style scoped>
.hero-image {
  width: 100%;
  max-height: 280px;
  object-fit: cover;
}

.details {
  padding: 1rem;
}

.price {
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--ion-color-primary);
}

.seller {
  color: var(--ion-color-medium);
}

.description {
  margin: 1rem 0;
  line-height: 1.5;
}

.meetup-cta {
  margin-top: 1.5rem;
}

.empty-state {
  padding: 2rem;
  text-align: center;
}
</style>
