<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button :default-href="`/tabs/selling/listing/${listingId}`" />
        </ion-buttons>
        <ion-title>FirmShakes</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <AppContentFrame>
        <div v-if="loading" class="empty-state">
          <ion-spinner name="crescent" />
          <p>Loading FirmShakes...</p>
        </div>

        <div v-else-if="error" class="empty-state">
          <p>{{ error }}</p>
        </div>

        <template v-else-if="listing">
          <h2>{{ listing.title }}</h2>
          <p class="subtitle">{{ formatPrice(listing.price) }}</p>

          <SellerFirmShakeList
            v-if="listingAgreements.length > 0"
            :agreements="listingAgreements"
            heading="Pending FirmShakes"
          />

          <ion-list v-if="declinedAgreements.length > 0" lines="full" class="declined-list">
            <ion-list-header>Declined</ion-list-header>
            <ion-item v-for="agreement in declinedAgreements" :key="agreement.id">
              <ion-label>
                <h2>{{ agreement.buyerName }}</h2>
                <p class="declined-label">FirmShake Declined</p>
              </ion-label>
              <ion-button
                slot="end"
                size="small"
                fill="outline"
                :router-link="`/tabs/firmshake/${agreement.id}`"
              >
                View
              </ion-button>
            </ion-item>
          </ion-list>

          <div v-if="listingAgreements.length === 0" class="empty-state">
            <p>No FirmShakes for this listing yet.</p>
          </div>
        </template>

        <div v-else class="empty-state">
          <p>Listing not found.</p>
        </div>
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { formatPrice } from '@/utils/currency';
import { computed, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { onIonViewWillEnter } from '@ionic/vue';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';

import AppContentFrame from '@/components/AppContentFrame.vue';
import SellerFirmShakeList from '@/features/meetups/components/SellerFirmShakeList.vue';
import { subscribeSellerAgreements } from '@/common/services/agreements';
import { authReady, currentUser } from '@/features/auth/services/auth';
import { getListingById } from '@/features/listings/services/listings';
import type { Agreement, Listing } from '@/types';

const route = useRoute();
const listingId = computed(() => route.params.listingId as string);

const loading = ref(true);
const error = ref('');
const listing = ref<Listing | null>(null);
const allAgreements = ref<Agreement[]>([]);

const listingAgreements = computed(() =>
  allAgreements.value.filter((agreement) => agreement.listingId === listingId.value),
);

const declinedAgreements = computed(() =>
  listingAgreements.value.filter(
    (agreement) =>
      agreement.status === 'cancelled' &&
      (!agreement.cancelledBy || agreement.cancelledBy === agreement.sellerId),
  ),
);

let unsubscribeAgreements: (() => void) | undefined;

async function waitForAuthReady() {
  if (authReady.value) {
    return;
  }

  await new Promise<void>((resolve) => {
    const interval = window.setInterval(() => {
      if (authReady.value) {
        window.clearInterval(interval);
        resolve();
      }
    }, 50);
  });
}

async function loadPage() {
  loading.value = true;
  error.value = '';

  await waitForAuthReady();

  const user = currentUser.value;
  if (!user) {
    loading.value = false;
    error.value = 'You must be signed in.';
    return;
  }

  listing.value = await getListingById(listingId.value);
  if (!listing.value || listing.value.sellerId !== user.uid) {
    loading.value = false;
    error.value = 'Listing not found or you are not the seller.';
    return;
  }

  unsubscribeAgreements?.();
  unsubscribeAgreements = subscribeSellerAgreements(user.uid, (agreements) => {
    allAgreements.value = agreements;
    loading.value = false;
  });
}

onIonViewWillEnter(() => {
  void loadPage();
});

onUnmounted(() => {
  unsubscribeAgreements?.();
});
</script>

<style scoped>
.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--ion-color-medium);
}

.subtitle {
  color: var(--ion-color-medium);
  margin-top: 0;
}

.declined-list {
  margin-top: 1.5rem;
}

.declined-label {
  color: var(--ion-color-medium);
  font-size: 0.85rem;
}
</style>
