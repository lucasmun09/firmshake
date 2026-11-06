<template>
  <div class="thread-actions" @click.stop>
    <ion-button size="small" fill="outline" :router-link="`/listing/${listingId}`">
      See listing
    </ion-button>

    <ion-button
      v-if="role === 'buyer' && firmShakeKind === 'none' && !listingDelisted"
      size="small"
      fill="outline"
      :disabled="interactionsDisabled"
      :router-link="interactionsDisabled ? undefined : `/listing/${listingId}/propose-meetup`"
    >
      Request FirmShake
    </ion-button>

    <ion-button
      v-else-if="role === 'buyer' && firmShakeKind === 'requested' && !listingDelisted"
      size="small"
      fill="outline"
      disabled
    >
      FirmShake Requested
    </ion-button>
  </div>
</template>

<script setup lang="ts">
import { IonButton } from '@ionic/vue';

import type { FirmShakeListingKind } from '@/common/services/agreements';

defineProps<{
  listingId: string;
  role: 'buyer' | 'seller';
  firmShakeKind: FirmShakeListingKind;
  listingDelisted?: boolean;
  interactionsDisabled?: boolean;
}>();
</script>

<style scoped>
.thread-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
</style>
