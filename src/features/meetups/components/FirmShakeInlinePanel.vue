<template>
  <div class="firmshake-panel">
    <h3 class="panel-title">FirmShake</h3>
    <p class="status-line">{{ getAgreementStatusLabel(agreement.status) }}</p>

    <ion-list lines="none" class="detail-list">
      <ion-item v-if="showBuyerName">
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
      <ion-button
        expand="block"
        color="success"
        :disabled="busy || interactionsDisabled"
        @click="handleAccept"
      >
        {{ busy ? 'Accepting...' : 'Accept FirmShake' }}
      </ion-button>
      <ion-button
        expand="block"
        color="medium"
        fill="outline"
        :disabled="busy || interactionsDisabled"
        @click="handleDecline"
      >
        Decline FirmShake
      </ion-button>
    </div>

    <div v-else-if="isBuyer && agreement.status === 'proposed'" class="action-stack">
      <ion-button
        expand="block"
        color="danger"
        fill="outline"
        :disabled="busy || interactionsDisabled"
        @click="handleCancel"
      >
        {{ busy ? 'Cancelling...' : 'Cancel FirmShake' }}
      </ion-button>
    </div>

    <div v-else-if="isBuyer && agreement.status === 'accepted'" class="action-stack">
      <ion-button expand="block" :disabled="busy || interactionsDisabled" @click="handlePayDeposit">
        {{ busy ? 'Processing...' : `Pay $${agreement.depositAmount} deposit` }}
      </ion-button>
    </div>

    <div v-else-if="agreement.status === 'deposit_paid'" class="action-stack">
      <ion-button expand="block" :disabled="busy || interactionsDisabled" @click="handleStartMeetup">
        {{ busy ? 'Starting...' : 'Start heading to meetup' }}
      </ion-button>
    </div>

    <div v-else-if="agreement.status === 'en_route'" class="action-stack">
      <ion-button
        expand="block"
        :disabled="interactionsDisabled"
        :router-link="interactionsDisabled ? undefined : `/meetup/${agreement.id}`"
      >
        Go to meetup
      </ion-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatPrice } from '@/utils/currency';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonButton, IonItem, IonLabel, IonList, toastController } from '@ionic/vue';

import {
  acceptMeetupProposal,
  cancelFirmShakeRequest,
  confirmMeetupDeposit,
  declineMeetupProposal,
  formatMeetupTime,
  getAgreementStatusLabel,
  startMeetupEnRoute,
} from '@/common/services/agreements';
import { formatMeetupLocation } from '@/features/meetups/utils/meetupLocation';
import { currentUser } from '@/features/auth/services/auth';
import type { Agreement } from '@/types';

const props = defineProps<{
  agreement: Agreement;
  role: 'buyer' | 'seller';
  showBuyerName?: boolean;
  interactionsDisabled?: boolean;
}>();

const router = useRouter();
const busy = ref(false);

const isSeller = computed(() => props.role === 'seller');
const isBuyer = computed(() => props.role === 'buyer');

async function handleAccept() {
  const user = currentUser.value;
  if (!user) {
    return;
  }

  busy.value = true;
  try {
    await acceptMeetupProposal(props.agreement.id, user.uid);
    await showToast('FirmShake accepted.', 'success');
  } catch (error) {
    await showToast(error instanceof Error ? error.message : 'Could not accept FirmShake', 'danger');
  } finally {
    busy.value = false;
  }
}

async function handleDecline() {
  const user = currentUser.value;
  if (!user) {
    return;
  }

  busy.value = true;
  try {
    await declineMeetupProposal(props.agreement.id, user.uid);
    await showToast('FirmShake declined.', 'medium');
  } catch (error) {
    await showToast(error instanceof Error ? error.message : 'Could not decline FirmShake', 'danger');
  } finally {
    busy.value = false;
  }
}

async function handleCancel() {
  const user = currentUser.value;
  if (!user) {
    return;
  }

  busy.value = true;
  try {
    await cancelFirmShakeRequest(props.agreement.id, user.uid);
    await showToast('FirmShake cancelled.', 'medium');
  } catch (error) {
    await showToast(error instanceof Error ? error.message : 'Could not cancel FirmShake', 'danger');
  } finally {
    busy.value = false;
  }
}

async function handlePayDeposit() {
  const user = currentUser.value;
  if (!user) {
    return;
  }

  busy.value = true;
  try {
    await confirmMeetupDeposit(props.agreement.id, user.uid);
    await showToast('Deposit confirmed.', 'success');
  } catch (error) {
    await showToast(error instanceof Error ? error.message : 'Could not confirm deposit', 'danger');
  } finally {
    busy.value = false;
  }
}

async function handleStartMeetup() {
  busy.value = true;
  try {
    await startMeetupEnRoute(props.agreement.id);
    await router.push(`/meetup/${props.agreement.id}`);
  } catch (error) {
    await showToast(error instanceof Error ? error.message : 'Could not start meetup', 'danger');
  } finally {
    busy.value = false;
  }
}

async function showToast(message: string, color: string) {
  const toast = await toastController.create({ message, duration: 2500, color });
  await toast.present();
}
</script>

<style scoped>
.firmshake-panel {
  margin: 0 1rem 1rem;
  padding: 1rem;
  border: 1px solid var(--ion-color-step-200);
  border-radius: 12px;
  background: var(--ion-color-step-50);
}

.panel-title {
  margin: 0;
  font-size: 1rem;
}

.status-line {
  color: var(--ion-color-primary);
  font-weight: 600;
  margin: 0.35rem 0 0.75rem;
  font-size: 0.9rem;
}

.detail-list {
  background: transparent;
  margin-bottom: 0.5rem;
}

.detail-list ion-item {
  --background: transparent;
  --padding-start: 0;
  --inner-padding-end: 0;
}

.detail-list p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.detail-list h2 {
  margin: 0.15rem 0 0.5rem;
  font-size: 0.95rem;
}

.action-stack {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
</style>
