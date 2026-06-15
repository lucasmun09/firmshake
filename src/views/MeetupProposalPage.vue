<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="`/listing/${listingId}`" />
        </ion-buttons>
        <ion-title>Request meetup</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <AppContentFrame>
      <div v-if="loading" class="centered">
        <ion-spinner name="crescent" />
      </div>

      <template v-else-if="listing">
        <h2>{{ listing.title }}</h2>
        <p class="subtitle">
          Propose a binding in-person meetup. The seller must accept before you pay the deposit.
        </p>

        <ion-list lines="full">
          <ion-item>
            <ion-label>
              <p>Agreed price</p>
              <h2>{{ formatPrice(listing.price) }}</h2>
            </ion-label>
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Meetup time</ion-label>
            <ion-datetime
              v-model="meetupAt"
              :min="minMeetupAt"
              presentation="date-time"
            />
          </ion-item>

          <ion-item>
            <ion-label>
              <p>Meetup location</p>
              <h2>{{ locationLabel }}</h2>
            </ion-label>
            <ion-button slot="end" fill="outline" size="small" @click="refreshLocation">
              Refresh
            </ion-button>
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Deposit amount (minimum ${{ minDeposit }})</ion-label>
            <ion-input
              v-model.number="depositAmount"
              type="number"
              :min="minDeposit"
              step="1"
              inputmode="numeric"
            />
          </ion-item>
        </ion-list>

        <ion-button
          expand="block"
          class="submit-button"
          :disabled="submitting || !canSubmit"
          @click="handleSubmit"
        >
          {{ submitting ? 'Sending request...' : 'Send binding meetup request' }}
        </ion-button>
      </template>

      <div v-else class="centered">
        <p>Listing not found.</p>
      </div>
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue';

import { proposeMeetupAgreement } from '@/services/agreements';
import AppContentFrame from '@/components/AppContentFrame.vue';
import { currentUser } from '@/services/auth';
import { getListingById } from '@/services/listings';
import { getCurrentCoordinates } from '@/services/locationTracking';
import { MEETUP_DEPOSIT_AMOUNT, MIN_MEETUP_DEPOSIT_AMOUNT, type Listing } from '@/types';

const route = useRoute();
const router = useRouter();

const listingId = route.params.id as string;
const listing = ref<Listing | null>(null);
const loading = ref(true);
const submitting = ref(false);
const meetupAt = ref(new Date(Date.now() + 60 * 60 * 1000).toISOString());
const meetupLat = ref<number | null>(null);
const meetupLng = ref<number | null>(null);
const depositAmount = ref(MEETUP_DEPOSIT_AMOUNT);
const minDeposit = MIN_MEETUP_DEPOSIT_AMOUNT;

const minMeetupAt = new Date().toISOString();

const locationLabel = computed(() => {
  if (meetupLat.value === null || meetupLng.value === null) {
    return 'Location not set';
  }

  return `${meetupLat.value.toFixed(4)}, ${meetupLng.value.toFixed(4)}`;
});

const canSubmit = computed(
  () =>
    Boolean(
      listing.value &&
        currentUser.value &&
        meetupLat.value !== null &&
        meetupLng.value !== null &&
        meetupAt.value &&
        depositAmount.value >= minDeposit,
    ),
);

onMounted(async () => {
  try {
    listing.value = await getListingById(listingId);
    await refreshLocation();
  } finally {
    loading.value = false;
  }
});

async function refreshLocation() {
  try {
    const coords = await getCurrentCoordinates();
    meetupLat.value = coords.lat;
    meetupLng.value = coords.lng;
  } catch (error) {
    const toast = await toastController.create({
      message: error instanceof Error ? error.message : 'Could not get your location',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  }
}

async function handleSubmit() {
  const user = currentUser.value;
  if (!user || !listing.value || meetupLat.value === null || meetupLng.value === null) {
    return;
  }

  submitting.value = true;

  try {
    await proposeMeetupAgreement({
      listingId: listing.value.id,
      buyerId: user.uid,
      buyerName: user.displayName ?? 'FirmShake User',
      sellerId: listing.value.sellerId,
      price: listing.value.price,
      meetupLat: meetupLat.value,
      meetupLng: meetupLng.value,
      meetupAt: new Date(meetupAt.value),
      depositAmount: Math.floor(depositAmount.value),
    });

    const toast = await toastController.create({
      message: 'Meetup request sent to the seller.',
      duration: 2500,
      color: 'success',
    });
    await toast.present();
    await router.replace(`/listing/${listing.value.id}`);
  } catch (error) {
    const toast = await toastController.create({
      message: error instanceof Error ? error.message : 'Could not send meetup request',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    submitting.value = false;
  }
}

function formatPrice(price: number): string {
  return price === 0 ? 'Free' : `$${price}`;
}
</script>

<style scoped>
.subtitle {
  color: var(--ion-color-medium);
  line-height: 1.4;
  margin-bottom: 1rem;
}

.centered {
  display: flex;
  justify-content: center;
  padding: 2rem;
}

.submit-button {
  margin-top: 1.5rem;
}
</style>
