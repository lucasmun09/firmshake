<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/profile" />
        </ion-buttons>
        <ion-title>Blocked Users</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <AppContentFrame>
        <div v-if="loading" class="centered">
          <ion-spinner name="crescent" />
        </div>

        <div v-else-if="blockedUsers.length === 0" class="empty-state">
          <p>You have not blocked anyone.</p>
        </div>

        <ion-list v-else>
          <ion-item v-for="entry in blockedUsers" :key="entry.blockedUserId">
            <UserAvatar
              slot="start"
              size="sm"
              :name="displayName(entry.blockedUserId)"
              :photo-url="photoUrl(entry.blockedUserId)"
            />
            <ion-label>
              <h2>{{ displayName(entry.blockedUserId) }}</h2>
            </ion-label>
            <ion-button
              slot="end"
              fill="outline"
              color="medium"
              :disabled="unblockingId === entry.blockedUserId"
              @click="confirmUnblock(entry.blockedUserId)"
            >
              Unblock
            </ion-button>
          </ion-item>
        </ion-list>
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  alertController,
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

import { useParticipantProfiles } from '@/common/composables/useParticipantProfiles';
import {
  subscribeBlockedUsers,
  unblockUser,
  type BlockedUserEntry,
} from '@/common/services/blocks';
import AppContentFrame from '@/components/AppContentFrame.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { currentUser } from '@/features/auth/services/auth';

const blockedUsers = ref<BlockedUserEntry[]>([]);
const loading = ref(true);
const unblockingId = ref<string | null>(null);

const blockedUserIds = computed(() => blockedUsers.value.map((entry) => entry.blockedUserId));
const { participantProfiles } = useParticipantProfiles(blockedUserIds);

let unsubscribeBlockedUsers: (() => void) | undefined;

function displayName(userId: string): string {
  return participantProfiles.value[userId]?.displayName ?? 'FirmShake User';
}

function photoUrl(userId: string): string | undefined {
  return participantProfiles.value[userId]?.photoUrl;
}

onMounted(() => {
  const user = currentUser.value;
  if (!user) {
    loading.value = false;
    return;
  }

  unsubscribeBlockedUsers = subscribeBlockedUsers(user.uid, (entries) => {
    blockedUsers.value = entries;
    loading.value = false;
  });
});

onUnmounted(() => {
  unsubscribeBlockedUsers?.();
});

async function confirmUnblock(blockedUserId: string) {
  const alert = await alertController.create({
    message:
      'The user will be unblocked, and each side can start communicating again. Would you like to proceed?',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Accept',
        handler: () => {
          void performUnblock(blockedUserId);
        },
      },
    ],
  });

  await alert.present();
}

async function performUnblock(blockedUserId: string) {
  const user = currentUser.value;
  if (!user) {
    return;
  }

  unblockingId.value = blockedUserId;

  try {
    await unblockUser(user.uid, blockedUserId);
  } catch {
    const toast = await toastController.create({
      message: 'Could not unblock user',
      duration: 2500,
      color: 'danger',
    });
    await toast.present();
  } finally {
    unblockingId.value = null;
  }
}
</script>

<style scoped>
.centered {
  display: flex;
  justify-content: center;
  padding: 2rem 0;
}

.empty-state {
  padding: 2rem 0;
  text-align: center;
  color: var(--ion-color-medium);
}

ion-item h2 {
  font-size: 1rem;
  font-weight: 600;
}
</style>
