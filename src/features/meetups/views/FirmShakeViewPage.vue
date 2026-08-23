<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/home" />
        </ion-buttons>
        <ion-title>View FirmShake</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <AppContentFrame>
        <div v-if="loading" class="empty-state">
          <ion-spinner name="crescent" />
          <p>Loading FirmShake...</p>
        </div>

        <div v-else-if="error" class="empty-state">
          <p>{{ error }}</p>
        </div>

        <template v-else-if="agreement && listing">
          <h2>{{ listing.title }}</h2>
          <p class="status-line">{{ getAgreementStatusLabel(agreement.status) }}</p>

          <ion-list lines="full">
            <ion-item>
              <ion-label>
                <p>Buyer</p>
                <h2>{{ agreement.buyerName }}</h2>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <p>Agreed price</p>
                <h2>{{ formatPrice(agreement.price) }}</h2>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <p>Meetup time</p>
                <h2>{{ formatMeetupTime(agreement.meetupAt) }}</h2>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <p>Meetup location</p>
                <h2>{{ formatMeetupLocation(agreement.meetupLat, agreement.meetupLng, agreement.meetupAddress) }}</h2>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <p>Deposit</p>
                <h2>${{ agreement.depositAmount }}</h2>
              </ion-label>
            </ion-item>
          </ion-list>

          <div v-if="isSeller && agreement.status === 'proposed'" class="action-stack">
            <ion-button expand="block" color="success" :disabled="busy" @click="handleAccept">
              {{ busy ? 'Accepting...' : 'Accept FirmShake' }}
            </ion-button>
            <ion-button expand="block" color="medium" fill="outline" :disabled="busy" @click="handleDecline">
              Decline FirmShake
            </ion-button>
          </div>

          <div v-else-if="isBuyer && agreement.status === 'proposed'" class="action-stack">
            <ion-button expand="block" color="danger" fill="outline" :disabled="busy" @click="handleCancel">
              {{ busy ? 'Cancelling...' : 'Cancel FirmShake' }}
            </ion-button>
          </div>

          <div v-else-if="isBuyer && agreement.status === 'accepted'" class="action-stack">
            <ion-button
              v-if="paymentsEnabled"
              expand="block"
              :disabled="busy"
              @click="handlePayDeposit"
            >
              {{ busy ? 'Processing...' : `Pay $${agreement.depositAmount} deposit` }}
            </ion-button>
            <ion-button v-else expand="block" disabled>
              Payments coming soon
            </ion-button>
          </div>

          <div v-else-if="agreement.status === 'deposit_paid'" class="action-stack">
            <ion-button expand="block" :disabled="busy" @click="handleStartMeetup">
              {{ busy ? 'Starting...' : 'Start heading to meetup' }}
            </ion-button>
          </div>

          <div v-else-if="agreement.status === 'en_route'" class="action-stack">
            <ion-button expand="block" :router-link="`/meetup/${agreement.id}`">
              Go to meetup
            </ion-button>
          </div>

          <ion-button
            expand="block"
            fill="clear"
            class="listing-link"
            :router-link="`/listing/${listing.id}`"
          >
            See listing
          </ion-button>
        </template>

        <div v-else class="empty-state">
          <p>FirmShake not found.</p>
        </div>
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { formatPrice } from '@/utils/currency';
import { computed, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue';

import { isPaymentsEnabled } from '@/common/config/featureFlags';
import { formatMeetupLocation } from '@/features/meetups/utils/meetupLocation';
import {
  acceptMeetupProposal,
  cancelFirmShakeRequest,
  confirmMeetupDeposit,
  declineMeetupProposal,
  formatMeetupTime,
  getAgreementStatusLabel,
  startMeetupEnRoute,
  subscribeAgreement,
} from '@/common/services/agreements';
import { authReady, currentUser } from '@/features/auth/services/auth';
import { getListingById } from '@/features/listings/services/listings';
import type { Agreement, Listing } from '@/types';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const error = ref('');
const busy = ref(false);
const agreement = ref<Agreement | null>(null);
const listing = ref<Listing | null>(null);
const paymentsEnabled = isPaymentsEnabled();

let unsubscribeAgreement: (() => void) | undefined;

const isSeller = computed(
  () =>
    Boolean(
      agreement.value &&
        currentUser.value &&
        agreement.value.sellerId === currentUser.value.uid,
    ),
);

const isBuyer = computed(
  () =>
    Boolean(
      agreement.value &&
        currentUser.value &&
        agreement.value.buyerId === currentUser.value.uid,
    ),
);

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

async function loadFirmShake() {
  loading.value = true;
  error.value = '';

  await waitForAuthReady();

  const user = currentUser.value;
  const agreementId = route.params.id as string;
  if (!user) {
    loading.value = false;
    error.value = 'You must be signed in to view this FirmShake.';
    return;
  }

  unsubscribeAgreement?.();

  unsubscribeAgreement = subscribeAgreement(agreementId, async (nextAgreement) => {
    if (!nextAgreement) {
      agreement.value = null;
      listing.value = null;
      loading.value = false;
      error.value = 'FirmShake not found.';
      return;
    }

    if (nextAgreement.buyerId !== user.uid && nextAgreement.sellerId !== user.uid) {
      agreement.value = null;
      listing.value = null;
      loading.value = false;
      error.value = 'You do not have access to this FirmShake.';
      return;
    }

    agreement.value = nextAgreement;
    listing.value = await getListingById(nextAgreement.listingId);
    loading.value = false;
    error.value = '';
  });
}

onIonViewWillEnter(() => {
  void loadFirmShake();
});

onUnmounted(() => {
  unsubscribeAgreement?.();
});

async function handleAccept() {
  const user = currentUser.value;
  if (!user || !agreement.value) {
    return;
  }

  busy.value = true;
  try {
    await acceptMeetupProposal(agreement.value.id, user.uid);
    const toast = await toastController.create({
      message: 'FirmShake accepted.',
      duration: 2500,
      color: 'success',
    });
    await toast.present();
  } catch (err) {
    const toast = await toastController.create({
      message: err instanceof Error ? err.message : 'Could not accept FirmShake',
      duration: 2500,
      color: 'danger',
    });
    await toast.present();
  } finally {
    busy.value = false;
  }
}

async function handleDecline() {
  const user = currentUser.value;
  if (!user || !agreement.value) {
    return;
  }

  busy.value = true;
  try {
    await declineMeetupProposal(agreement.value.id, user.uid);
    const toast = await toastController.create({
      message: 'FirmShake declined.',
      duration: 2500,
      color: 'medium',
    });
    await toast.present();
  } catch (err) {
    const toast = await toastController.create({
      message: err instanceof Error ? err.message : 'Could not decline FirmShake',
      duration: 2500,
      color: 'danger',
    });
    await toast.present();
  } finally {
    busy.value = false;
  }
}

async function handleCancel() {
  const user = currentUser.value;
  if (!user || !agreement.value) {
    return;
  }

  busy.value = true;
  try {
    await cancelFirmShakeRequest(agreement.value.id, user.uid);
    const toast = await toastController.create({
      message: 'FirmShake cancelled.',
      duration: 2500,
      color: 'medium',
    });
    await toast.present();
    void router.back();
  } catch (err) {
    const toast = await toastController.create({
      message: err instanceof Error ? err.message : 'Could not cancel FirmShake',
      duration: 2500,
      color: 'danger',
    });
    await toast.present();
  } finally {
    busy.value = false;
  }
}

async function handlePayDeposit() {
  if (!paymentsEnabled) {
    return;
  }
  const user = currentUser.value;
  if (!user || !agreement.value) {
    return;
  }

  busy.value = true;
  try {
    await confirmMeetupDeposit(agreement.value.id, user.uid);
    const toast = await toastController.create({
      message: 'Deposit confirmed.',
      duration: 2500,
      color: 'success',
    });
    await toast.present();
  } catch (err) {
    const toast = await toastController.create({
      message: err instanceof Error ? err.message : 'Could not confirm deposit',
      duration: 2500,
      color: 'danger',
    });
    await toast.present();
  } finally {
    busy.value = false;
  }
}

async function handleStartMeetup() {
  if (!agreement.value) {
    return;
  }

  busy.value = true;
  try {
    await startMeetupEnRoute(agreement.value.id);
    await router.push(`/meetup/${agreement.value.id}`);
  } catch (err) {
    const toast = await toastController.create({
      message: err instanceof Error ? err.message : 'Could not start meetup',
      duration: 2500,
      color: 'danger',
    });
    await toast.present();
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--ion-color-medium);
}

.status-line {
  color: var(--ion-color-primary);
  font-weight: 600;
  margin-top: 0;
}

.action-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.listing-link {
  margin-top: 0.5rem;
}
</style>
