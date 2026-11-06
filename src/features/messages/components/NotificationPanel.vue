<template>
  <Teleport to="body">
    <div v-if="isOpen" class="notification-backdrop" @click="emit('close')">
      <div class="notification-panel" @click.stop>
        <div class="panel-header">
          <h3>Notifications</h3>
          <ion-button
            v-if="notifications.some((entry) => !entry.read)"
            fill="clear"
            size="small"
            :disabled="clearing"
            @click="handleClearAll"
          >
            Clear all
          </ion-button>
        </div>

        <div v-if="loading" class="panel-empty">
          <ion-spinner name="crescent" />
        </div>

        <div v-else-if="notifications.length === 0" class="panel-empty">
          <p>No notifications yet.</p>
        </div>

        <div v-else class="panel-list">
          <button
            v-for="notification in notifications"
            :key="notification.id"
            type="button"
            class="notification-row"
            @click="handleNotificationClick(notification)"
          >
            <div class="notification-copy">
              <strong>{{ notification.title }}</strong>
              <p>{{ notification.body }}</p>
              <span v-if="notification.createdAt" class="timestamp">
                {{ formatTimestamp(notification.createdAt) }}
              </span>
            </div>
            <span v-if="!notification.read" class="unread-dot" aria-label="Unread" />
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { IonButton, IonSpinner, toastController } from '@ionic/vue';

import { authReady, resolveSessionUser } from '@/features/auth/services/auth';
import { getListingById } from '@/features/listings/services/listings';
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
} from '@/features/messages/services/notifications';
import type { AppNotification } from '@/types';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const router = useRouter();
const notifications = ref<AppNotification[]>([]);
const loading = ref(false);
const clearing = ref(false);

let unsubscribeNotifications: (() => void) | undefined;

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      startSubscription();
      return;
    }

    stopSubscription();
  },
);

watch(
  [() => props.isOpen, authReady, () => resolveSessionUser()?.uid],
  ([open]) => {
    if (open) {
      startSubscription();
    }
  },
);

onUnmounted(() => {
  stopSubscription();
});

function startSubscription() {
  if (!props.isOpen) {
    return;
  }

  unsubscribeNotifications?.();
  unsubscribeNotifications = undefined;

  if (!authReady.value) {
    loading.value = true;
    return;
  }

  const user = resolveSessionUser();
  if (!user) {
    notifications.value = [];
    loading.value = false;
    return;
  }

  loading.value = true;
  unsubscribeNotifications = subscribeNotifications(
    user.uid,
    (nextNotifications) => {
      notifications.value = nextNotifications;
      loading.value = false;
    },
    () => {
      loading.value = false;
    },
  );
}

function stopSubscription() {
  unsubscribeNotifications?.();
  unsubscribeNotifications = undefined;
}

async function handleClearAll() {
  const user = resolveSessionUser();
  if (!user) {
    return;
  }

  clearing.value = true;
  try {
    await markAllNotificationsRead(user.uid);
  } catch {
    const toast = await toastController.create({
      message: 'Could not clear notifications.',
      duration: 2500,
      color: 'danger',
    });
    await toast.present();
  } finally {
    clearing.value = false;
  }
}

async function handleNotificationClick(notification: AppNotification) {
  const user = resolveSessionUser();
  if (!user) {
    return;
  }

  if (!notification.read) {
    await markNotificationRead(user.uid, notification.id);
  }

  emit('close');

  if (!notification.listingId) {
    return;
  }

  if (notification.type === 'meetup') {
    const listing = await getListingById(notification.listingId);
    if (listing?.sellerId === user.uid) {
      const buyerId = notification.actorId !== user.uid ? notification.actorId : undefined;
      void router.push(
        buyerId
          ? `/tabs/selling/listing/${notification.listingId}?buyerId=${encodeURIComponent(buyerId)}`
          : `/tabs/selling/listing/${notification.listingId}`,
      );
      return;
    }

    void router.push(`/tabs/buying/listing/${notification.listingId}`);
    return;
  }

  if (notification.type === 'message') {
    const listing = await getListingById(notification.listingId);
    if (listing?.sellerId === user.uid) {
      const buyerId = notification.actorId !== user.uid ? notification.actorId : undefined;
      void router.push(
        buyerId
          ? `/tabs/selling/listing/${notification.listingId}?buyerId=${encodeURIComponent(buyerId)}`
          : `/tabs/selling/listing/${notification.listingId}`,
      );
      return;
    }

    void router.push(`/tabs/buying/listing/${notification.listingId}`);
    return;
  }

  void router.push(`/listing/${notification.listingId}`);
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString();
}
</script>

<style scoped>
.notification-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20000;
  background: rgba(0, 0, 0, 0.15);
}

.notification-panel {
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + 2.5rem);
  right: 0.75rem;
  width: min(22rem, calc(100vw - 1.5rem));
  max-height: min(28rem, calc(100vh - 5rem));
  background: var(--ion-background-color);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0.75rem 0.5rem 1rem;
  border-bottom: 1px solid var(--ion-color-step-150);
}

.panel-header h3 {
  margin: 0;
  font-size: 1rem;
}

.panel-list {
  overflow-y: auto;
}

.notification-row {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  border: 0;
  border-bottom: 1px solid var(--ion-color-step-100);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.notification-row:hover {
  background: var(--ion-color-step-50);
}

.notification-copy {
  flex: 1;
  min-width: 0;
}

.notification-copy strong {
  display: block;
  font-size: 0.95rem;
}

.notification-copy p {
  margin: 0.25rem 0 0;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.timestamp {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ion-color-primary);
  margin-top: 0.35rem;
  flex-shrink: 0;
}

.panel-empty {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--ion-color-medium);
}
</style>
