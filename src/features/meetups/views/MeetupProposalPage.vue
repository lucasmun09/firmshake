<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="`/listing/${listingId}`" />
        </ion-buttons>
        <ion-title>Request FirmShake</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <AppContentFrame>
      <div v-if="loading" class="centered">
        <ion-spinner name="crescent" />
      </div>

      <template v-else-if="listing">
        <h2>{{ listing.title }}</h2>
        <p class="subtitle">
          Propose a FirmShake with the seller. They must accept before you pay the deposit.
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
        </ion-list>

        <AddressAutocomplete v-model="meetupLocation" />

        <ion-list lines="full">
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
          {{ submitting ? 'Sending request...' : 'Send FirmShake request' }}
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
import { formatPrice } from '@/utils/currency';
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

import AddressAutocomplete from '@/components/AddressAutocomplete.vue';
import { proposeMeetupAgreement } from '@/common/services/agreements';
import AppContentFrame from '@/components/AppContentFrame.vue';
import { currentUser } from '@/features/auth/services/auth';
import { getListingById } from '@/features/listings/services/listings';
import type { MeetupLocation } from '@/features/meetups/types/meetupLocation';
import { MEETUP_DEPOSIT_AMOUNT, MIN_MEETUP_DEPOSIT_AMOUNT, type Listing } from '@/types';

const route = useRoute();
const router = useRouter();

const listingId = route.params.id as string;
const listing = ref<Listing | null>(null);
const loading = ref(true);
const submitting = ref(false);
const meetupAt = ref(new Date(Date.now() + 60 * 60 * 1000).toISOString());
const meetupLocation = ref<MeetupLocation | null>(null);
const depositAmount = ref(MEETUP_DEPOSIT_AMOUNT);
const minDeposit = MIN_MEETUP_DEPOSIT_AMOUNT;

const minMeetupAt = new Date().toISOString();

const canSubmit = computed(
  () =>
    Boolean(
      listing.value &&
        currentUser.value &&
        meetupLocation.value &&
        meetupAt.value &&
        depositAmount.value >= minDeposit,
    ),
);

onMounted(async () => {
  try {
    listing.value = await getListingById(listingId);
  } finally {
    loading.value = false;
  }
});

async function handleSubmit() {
  const user = currentUser.value;
  if (!user || !listing.value || !meetupLocation.value) {
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
      meetupLat: meetupLocation.value.lat,
      meetupLng: meetupLocation.value.lng,
      meetupAddress: meetupLocation.value.address,
      meetupAt: new Date(meetupAt.value),
      depositAmount: Math.floor(depositAmount.value),
    });

    const toast = await toastController.create({
      message: 'FirmShake request sent to the seller.',
      duration: 2500,
      color: 'success',
    });
    await toast.present();
    await router.replace(`/tabs/buying/listing/${listing.value.id}`);
  } catch (error) {
    const toast = await toastController.create({
      message: error instanceof Error ? error.message : 'Could not send FirmShake request',
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
