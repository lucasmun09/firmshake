<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="`/listing/${agreement?.listingId ?? '/tabs/home'}`" />
        </ion-buttons>
        <ion-title>Meetup</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <AppContentFrame>
      <div v-if="loading" class="centered">
        <ion-spinner name="crescent" />
      </div>

      <template v-else-if="agreement">
        <ion-chip :color="statusColor">{{ statusLabel }}</ion-chip>

        <h2 v-if="agreement.status === 'en_route'">Heading to meetup</h2>
        <h2 v-else>Meetup not active yet</h2>

        <p class="hint">
          <template v-if="agreement.status === 'en_route'">
            Your location is sent every minute. The other person sees ETA and progress only —
            never your exact coordinates.
          </template>
          <template v-else>
            Location sharing starts once both parties are en route. Current status:
            {{ statusLabel }}.
          </template>
        </p>

        <ion-card v-if="agreement.meetupAt">
          <ion-card-content>
            <p><strong>Scheduled:</strong> {{ formatMeetupTime(agreement.meetupAt) }}</p>
          </ion-card-content>
        </ion-card>

        <template v-if="agreement.status === 'en_route'">
          <ion-card>
            <ion-card-header>
              <ion-card-title>Your status</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <p v-if="myEta.etaMinutes !== undefined">
                ETA: <strong>{{ myEta.etaMinutes }} min</strong>
              </p>
              <p v-else>Waiting for first location update...</p>
              <ion-progress-bar
                v-if="myEta.progressPercent !== undefined"
                :value="(myEta.progressPercent ?? 0) / 100"
              />
            </ion-card-content>
          </ion-card>

          <ion-card>
            <ion-card-header>
              <ion-card-title>Other party</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <p v-if="otherEta.etaMinutes !== undefined">
                ETA: <strong>{{ otherEta.etaMinutes }} min</strong>
              </p>
              <p v-else>Waiting for their location...</p>
              <ion-progress-bar
                v-if="otherEta.progressPercent !== undefined"
                :value="(otherEta.progressPercent ?? 0) / 100"
                color="secondary"
              />
            </ion-card-content>
          </ion-card>

          <ion-button
            expand="block"
            :color="tracking ? 'danger' : 'primary'"
            :disabled="trackingBusy"
            @click="toggleTracking"
          >
            {{ tracking ? 'Stop sharing location' : 'Start sharing location' }}
          </ion-button>

          <p v-if="tracking" class="tracking-note">Polling location every 60 seconds</p>
        </template>

        <ion-button
          v-else-if="agreement.status === 'deposit_paid'"
          expand="block"
          :disabled="trackingBusy"
          @click="handleStartEnRoute"
        >
          {{ trackingBusy ? 'Starting...' : 'Start heading to meetup' }}
        </ion-button>
      </template>

      <div v-else class="centered">
        <p>Meetup not found.</p>
      </div>
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonContent,
  IonHeader,
  IonPage,
  IonProgressBar,
  IonSpinner,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue';

import {
  formatMeetupTime,
  getAgreementStatusLabel,
  getMyEta,
  getOtherPartyEta,
  startMeetupEnRoute,
  subscribeAgreement,
} from '@/common/services/agreements';
import { currentUser } from '@/features/auth/services/auth';
import AppContentFrame from '@/components/AppContentFrame.vue';
import {
  isMeetupLocationPolling,
  startMeetupLocationPolling,
  stopMeetupLocationPolling,
} from '@/common/services/locationTracking';
import type { Agreement } from '@/types';

const route = useRoute();
const agreement = ref<Agreement | null>(null);
const loading = ref(true);
const tracking = ref(false);
const trackingBusy = ref(false);

let unsubscribeAgreement: (() => void) | undefined;

const myEta = computed(() => {
  if (!agreement.value || !currentUser.value) return {};
  return getMyEta(agreement.value, currentUser.value.uid);
});

const otherEta = computed(() => {
  if (!agreement.value || !currentUser.value) return {};
  return getOtherPartyEta(agreement.value, currentUser.value.uid);
});

const statusLabel = computed(() =>
  agreement.value ? getAgreementStatusLabel(agreement.value.status) : '',
);

const statusColor = computed(() => {
  if (!agreement.value) {
    return 'medium';
  }

  switch (agreement.value.status) {
    case 'en_route':
      return 'success';
    case 'deposit_paid':
      return 'primary';
    case 'accepted':
      return 'warning';
    default:
      return 'medium';
  }
});

onMounted(() => {
  const agreementId = route.params.id as string;
  tracking.value = isMeetupLocationPolling();

  unsubscribeAgreement = subscribeAgreement(agreementId, (nextAgreement) => {
    agreement.value = nextAgreement;
    loading.value = false;
  });
});

onUnmounted(() => {
  unsubscribeAgreement?.();
});

async function handleStartEnRoute() {
  if (!agreement.value) {
    return;
  }

  trackingBusy.value = true;
  try {
    await startMeetupEnRoute(agreement.value.id);
  } catch (err) {
    const toast = await toastController.create({
      message: err instanceof Error ? err.message : 'Could not start meetup',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    trackingBusy.value = false;
  }
}

async function toggleTracking() {
  if (!agreement.value || agreement.value.status !== 'en_route') {
    return;
  }

  trackingBusy.value = true;

  try {
    if (tracking.value) {
      await stopMeetupLocationPolling();
      tracking.value = false;
      return;
    }

    await startMeetupLocationPolling(agreement.value.id);
    tracking.value = true;
  } catch (err) {
    const toast = await toastController.create({
      message: err instanceof Error ? err.message : 'Could not start location sharing',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    trackingBusy.value = false;
  }
}
</script>

<style scoped>
.hint {
  color: var(--ion-color-medium);
  line-height: 1.4;
}

.centered {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
}

.tracking-note {
  text-align: center;
  color: var(--ion-color-medium);
  margin-top: 0.75rem;
  font-size: 0.9rem;
}
</style>
