<template>
  <ion-button fill="clear" size="small" class="overflow-button" @click.stop="presentMenu">
    <ion-icon slot="icon-only" :icon="ellipsisVertical" aria-label="Conversation options" />
  </ion-button>
</template>

<script setup lang="ts">
import { IonButton, IonIcon, actionSheetController, toastController } from '@ionic/vue';
import { ellipsisVertical } from 'ionicons/icons';

import { currentUser } from '@/features/auth/services/auth';
import {
  routeArchiveConversation,
  routeUnarchiveConversation,
} from '@/features/messages/services/inboxServiceRouter';

const props = defineProps<{
  listingId: string;
  buyerId?: string;
  isArchived: boolean;
}>();

const emit = defineEmits<{
  changed: [];
}>();

async function presentMenu() {
  const sheet = await actionSheetController.create({
    header: 'Conversation',
    buttons: [
      {
        text: props.isArchived ? 'Unarchive' : 'Archive',
        handler: () => {
          void toggleArchive();
        },
      },
      {
        text: 'Cancel',
        role: 'cancel',
      },
    ],
  });

  await sheet.present();
}

async function toggleArchive() {
  const userId = currentUser.value?.uid;
  if (!userId) {
    return;
  }

  try {
    if (props.isArchived) {
      await routeUnarchiveConversation(userId, props.listingId, props.buyerId);
    } else {
      await routeArchiveConversation(userId, props.listingId, props.buyerId);
    }
    emit('changed');
  } catch {
    const toast = await toastController.create({
      message: props.isArchived
        ? 'Could not unarchive this conversation.'
        : 'Could not archive this conversation.',
      duration: 2500,
      color: 'danger',
    });
    await toast.present();
  }
}
</script>

<style scoped>
.overflow-button {
  --padding-start: 0.25rem;
  --padding-end: 0.25rem;
  margin: 0;
}
</style>
