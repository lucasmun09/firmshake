<template>
  <div v-if="proposedAgreements.length > 0 || activeAgreements.length > 0" class="firmshake-list">
    <h3 v-if="showHeading">{{ heading }}</h3>

    <ion-list v-if="proposedAgreements.length > 0" lines="full">
      <ion-item v-for="agreement in proposedAgreements" :key="agreement.id">
        <ion-label>
          <h2>{{ agreement.buyerName }}</h2>
          <p>{{ formatPrice(agreement.price) }} · {{ formatMeetupTime(agreement.meetupAt) }}</p>
          <p class="status">FirmShake Received</p>
        </ion-label>
        <ion-button
          slot="end"
          size="small"
          fill="outline"
          :router-link="`/tabs/firmshake/${agreement.id}`"
        >
          View FirmShake
        </ion-button>
      </ion-item>
    </ion-list>

    <ion-list v-if="activeAgreements.length > 0" lines="full" class="active-list">
      <ion-item v-for="agreement in activeAgreements" :key="agreement.id">
        <ion-label>
          <h2>{{ agreement.buyerName }}</h2>
          <p>{{ getAgreementStatusLabel(agreement.status) }}</p>
        </ion-label>
        <ion-button
          slot="end"
          size="small"
          fill="outline"
          :router-link="`/tabs/firmshake/${agreement.id}`"
        >
          View FirmShake
        </ion-button>
      </ion-item>
    </ion-list>
  </div>
</template>

<script setup lang="ts">
import { formatPrice } from '@/utils/currency';
import { computed } from 'vue';
import { IonButton, IonItem, IonLabel, IonList } from '@ionic/vue';

import {
  formatMeetupTime,
  getAgreementStatusLabel,
  getProposedAgreements,
} from '@/common/services/agreements';
import type { Agreement } from '@/types';

const props = withDefaults(
  defineProps<{
    agreements: Agreement[];
    showHeading?: boolean;
    heading?: string;
  }>(),
  {
    showHeading: true,
    heading: 'Pending FirmShakes',
  },
);

const proposedAgreements = computed(() => getProposedAgreements(props.agreements));

const activeAgreements = computed(() =>
  props.agreements.filter((agreement) =>
    ['accepted', 'deposit_paid', 'en_route'].includes(agreement.status),
  ),
);
</script>

<style scoped>
.firmshake-list h3 {
  margin: 0.75rem 0 0.25rem;
  font-size: 0.95rem;
}

.status {
  color: var(--ion-color-primary);
  font-size: 0.85rem;
  font-weight: 600;
}

.active-list {
  margin-top: 0.5rem;
}
</style>
