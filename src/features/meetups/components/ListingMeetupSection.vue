<template>
  <div class="meetup-section">
    <h2>FirmShake</h2>

    <template v-if="isSeller">
      <p v-if="sellerAgreements.length === 0" class="meetup-hint">
        Buyers can request a FirmShake from this listing.
      </p>

      <ion-list v-else lines="full" class="request-list">
        <ion-item v-for="agreement in sellerAgreements" :key="agreement.id">
          <ion-label>
            <h2>{{ agreement.buyerName }}</h2>
            <p>{{ formatPrice(agreement.price) }} · {{ formatMeetupTime(agreement.meetupAt) }}</p>
            <p>${{ agreement.depositAmount }} deposit · {{ getAgreementStatusLabel(agreement.status) }}</p>
          </ion-label>

          <div v-if="agreement.status === 'proposed'" slot="end" class="action-buttons">
            <ion-button
              size="small"
              color="success"
              :disabled="isAgreementDisabled(agreement)"
              @click="$emit('accept', agreement.id)"
            >
              Accept
            </ion-button>
            <ion-button
              size="small"
              color="medium"
              fill="outline"
              :disabled="isAgreementDisabled(agreement)"
              @click="$emit('decline', agreement.id)"
            >
              Decline
            </ion-button>
          </div>

          <ion-button
            v-else-if="agreement.status === 'deposit_paid'"
            slot="end"
            size="small"
            :disabled="busy || isAgreementDisabled(agreement)"
            @click="$emit('start-meetup', agreement.id)"
          >
            Start
          </ion-button>

          <ion-button
            v-else-if="agreement.status === 'en_route'"
            slot="end"
            size="small"
            :disabled="isAgreementDisabled(agreement)"
            :router-link="isAgreementDisabled(agreement) ? undefined : `/meetup/${agreement.id}`"
          >
            Track
          </ion-button>
        </ion-item>
      </ion-list>
    </template>

    <template v-else>
      <p v-if="!buyerAgreement" class="meetup-hint">
        Request a FirmShake with the seller. They must accept before you pay the deposit.
      </p>

      <ion-card v-else>
        <ion-card-content>
          <p><strong>Status:</strong> {{ getAgreementStatusLabel(buyerAgreement.status) }}</p>
          <p><strong>Meetup:</strong> {{ formatMeetupTime(buyerAgreement.meetupAt) }}</p>
          <p><strong>Deposit:</strong> ${{ buyerAgreement.depositAmount }}</p>
        </ion-card-content>
      </ion-card>

      <ion-button
        v-if="!buyerAgreement"
        expand="block"
        class="meetup-cta"
        :disabled="buyerInteractionDisabled"
        :router-link="buyerInteractionDisabled ? undefined : `/listing/${listingId}/propose-meetup`"
      >
        Request FirmShake
      </ion-button>

      <ion-button
        v-else-if="buyerAgreement.status === 'proposed'"
        expand="block"
        class="meetup-cta"
        disabled
      >
        Awaiting seller acceptance
      </ion-button>

      <ion-button
        v-else-if="buyerAgreement.status === 'accepted' && paymentsEnabled"
        expand="block"
        class="meetup-cta"
        :disabled="busy || buyerInteractionDisabled"
        @click="$emit('pay-deposit', buyerAgreement.id)"
      >
        {{ busy ? 'Processing...' : `Pay $${buyerAgreement.depositAmount} deposit` }}
      </ion-button>

      <ion-button
        v-else-if="buyerAgreement.status === 'accepted'"
        expand="block"
        class="meetup-cta"
        disabled
      >
        Payments coming soon
      </ion-button>

      <ion-button
        v-else-if="buyerAgreement.status === 'deposit_paid'"
        expand="block"
        class="meetup-cta"
        :disabled="busy || buyerInteractionDisabled"
        @click="$emit('start-meetup', buyerAgreement.id)"
      >
        {{ busy ? 'Starting...' : 'Start heading to meetup' }}
      </ion-button>

      <ion-button
        v-else-if="buyerAgreement.status === 'en_route'"
        expand="block"
        class="meetup-cta"
        :disabled="buyerInteractionDisabled"
        :router-link="buyerInteractionDisabled ? undefined : `/meetup/${buyerAgreement.id}`"
      >
        Go to meetup
      </ion-button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatPrice } from '@/utils/currency';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonList,
} from '@ionic/vue';

import {
  formatMeetupTime,
  getAgreementStatusLabel,
} from '@/common/services/agreements';
import { isPaymentsEnabled } from '@/common/config/featureFlags';
import type { Agreement } from '@/types';

const props = defineProps<{
  isSeller: boolean;
  listingId: string;
  buyerAgreement: Agreement | null;
  sellerAgreements: Agreement[];
  busy?: boolean;
  blockedPartnerId?: string | null;
}>();

const paymentsEnabled = isPaymentsEnabled();

defineEmits<{
  accept: [agreementId: string];
  decline: [agreementId: string];
  'pay-deposit': [agreementId: string];
  'start-meetup': [agreementId: string];
}>();

const buyerInteractionDisabled = computed(() => {
  if (!props.blockedPartnerId || !props.buyerAgreement) {
    return Boolean(props.blockedPartnerId);
  }

  return (
    props.buyerAgreement.buyerId === props.blockedPartnerId
    || props.buyerAgreement.sellerId === props.blockedPartnerId
  );
});

function isAgreementDisabled(agreement: Agreement): boolean {
  if (!props.blockedPartnerId) {
    return false;
  }

  return agreement.buyerId === props.blockedPartnerId
    || agreement.sellerId === props.blockedPartnerId;
}
</script>

<style scoped>
.meetup-section {
  padding: 0 1rem 1rem;
  border-top: 1px solid var(--ion-color-step-150);
}

.meetup-section h2 {
  margin: 1rem 0 0.25rem;
}

.meetup-hint {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
  line-height: 1.4;
}

.meetup-cta {
  margin-top: 1rem;
}

.request-list {
  margin-top: 0.5rem;
}

.status-line {
  color: var(--ion-color-primary);
  font-size: 0.85rem;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
</style>
