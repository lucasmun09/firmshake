<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Inbox</ion-title>
      </ion-toolbar>
      <ion-toolbar class="app-toolbar-content">
        <AppContentFrame>
          <ion-segment v-model="selectedTab" @ionChange="onTabChange">
            <ion-segment-button value="messages">
              <ion-label>Messages</ion-label>
            </ion-segment-button>
            <ion-segment-button value="notifications">
              <ion-label>Notifications</ion-label>
            </ion-segment-button>
          </ion-segment>
        </AppContentFrame>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <AppContentFrame>
        <div v-if="loading" class="empty-state">
        <ion-spinner name="crescent" />
        <p>Loading inbox...</p>
      </div>

      <div v-else-if="error" class="empty-state">
        <p>{{ error }}</p>
      </div>

      <template v-else-if="selectedTab === 'messages'">
        <div
          v-if="
            sellerThreads.length === 0 &&
            buyerThreads.length === 0 &&
            unclassifiedThreads.length === 0
          "
          class="empty-state"
        >
          <p>No message threads yet.</p>
          <p class="hint">Message a seller from a listing to start a conversation.</p>
        </div>

        <template v-else>
          <ion-list v-if="sellerThreads.length > 0">
            <ion-list-header>My listings</ion-list-header>
            <ion-item
              v-for="thread in sellerThreads"
              :key="thread.listingId"
              button
              :router-link="sellerThreadLink(thread)"
              detail
            >
              <ion-thumbnail slot="start">
                <AuthenticatedImage
                  :src="thread.listingImageUrl || placeholderImage"
                  :alt="thread.listingTitle"
                />
              </ion-thumbnail>
              <ion-label>
                <h2>{{ thread.listingTitle }}</h2>
                <p>{{ thread.lastMessageSenderName }}: {{ thread.lastMessageText }}</p>
              </ion-label>
            </ion-item>
          </ion-list>

          <ion-list v-if="buyerThreads.length > 0">
            <ion-list-header>Conversations</ion-list-header>
            <ion-item
              v-for="thread in buyerThreads"
              :key="thread.listingId"
              button
              :router-link="`/inbox/listing/${thread.listingId}`"
              detail
            >
              <ion-thumbnail slot="start">
                <AuthenticatedImage
                  :src="thread.listingImageUrl || placeholderImage"
                  :alt="thread.listingTitle"
                />
              </ion-thumbnail>
              <ion-label>
                <h2>{{ thread.listingTitle }}</h2>
                <p v-if="thread.sellerName">Seller: {{ thread.sellerName }}</p>
                <p>{{ thread.lastMessageSenderName }}: {{ thread.lastMessageText }}</p>
              </ion-label>
            </ion-item>
          </ion-list>

          <ion-list v-if="unclassifiedThreads.length > 0">
            <ion-list-header>Messages</ion-list-header>
            <ion-item
              v-for="thread in unclassifiedThreads"
              :key="thread.listingId"
              button
              :router-link="`/inbox/listing/${thread.listingId}`"
              detail
            >
              <ion-thumbnail slot="start">
                <AuthenticatedImage
                  :src="thread.listingImageUrl || placeholderImage"
                  :alt="thread.listingTitle"
                />
              </ion-thumbnail>
              <ion-label>
                <h2>{{ thread.listingTitle }}</h2>
                <p>{{ thread.lastMessageSenderName }}: {{ thread.lastMessageText }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </template>
      </template>

      <template v-else>
        <div v-if="notifications.length === 0" class="empty-state">
          <p>No notifications yet.</p>
        </div>

        <ion-list v-else>
          <ion-item
            v-for="notification in notifications"
            :key="notification.id"
            button
            :detail="Boolean(notification.listingId)"
            @click="handleNotificationClick(notification)"
          >
            <ion-label>
              <h2>{{ notification.title }}</h2>
              <p>{{ notification.body }}</p>
              <p v-if="notification.createdAt" class="timestamp">
                {{ formatTimestamp(notification.createdAt) }}
              </p>
            </ion-label>
            <ion-badge v-if="!notification.read" slot="end" color="primary">New</ion-badge>
          </ion-item>
        </ion-list>
      </template>
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { onIonViewWillEnter } from '@ionic/vue';
import {
  IonBadge,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonThumbnail,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';

import { authReady, currentUser } from '@/services/auth';
import AppContentFrame from '@/components/AppContentFrame.vue';
import AuthenticatedImage from '@/components/AuthenticatedImage.vue';
import {
  markNotificationRead,
  subscribeNotifications,
} from '@/services/notifications';
import { rebuildThreadsForUser, subscribeInboxThreads } from '@/services/threads';
import type { AppNotification, MessageThread } from '@/types';

const router = useRouter();
const placeholderImage = 'https://ionicframework.com/docs/img/demos/thumbnail.svg';

const selectedTab = ref<'messages' | 'notifications'>('messages');
const loading = ref(true);
const error = ref('');
const threads = ref<MessageThread[]>([]);
const notifications = ref<AppNotification[]>([]);

const sellerThreads = computed(() =>
  threads.value.filter((thread) => thread.sellerId === currentUser.value?.uid),
);

const buyerThreads = computed(() =>
  threads.value.filter((thread) => {
    const userId = currentUser.value?.uid;
    if (!userId || !thread.sellerId) {
      return false;
    }

    return thread.sellerId !== userId;
  }),
);

const unclassifiedThreads = computed(() =>
  threads.value.filter((thread) => !thread.sellerId),
);

let unsubscribeThreads: (() => void) | undefined;
let unsubscribeNotifications: (() => void) | undefined;

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

async function startInboxSubscriptions() {
  loading.value = true;
  error.value = '';

  await waitForAuthReady();

  const user = currentUser.value;
  if (!user) {
    loading.value = false;
    error.value = 'You must be signed in to view your inbox.';
    return;
  }

  unsubscribeThreads?.();
  unsubscribeNotifications?.();

  unsubscribeThreads = subscribeInboxThreads(
    user.uid,
    (nextThreads) => {
      threads.value = nextThreads;
      loading.value = false;
    },
    (loadError) => {
      error.value = 'Could not load your message threads. Please try again.';
      loading.value = false;
      console.error(loadError);
    },
  );

  unsubscribeNotifications = subscribeNotifications(user.uid, (nextNotifications) => {
    notifications.value = nextNotifications;
  });

  void rebuildThreadsForUser(user.uid).catch((rebuildError) => {
    console.error('Thread rebuild failed', rebuildError);
  });
}

onIonViewWillEnter(() => {
  void startInboxSubscriptions();
});

onUnmounted(() => {
  unsubscribeThreads?.();
  unsubscribeNotifications?.();
});

function onTabChange(event: CustomEvent) {
  selectedTab.value = event.detail.value as 'messages' | 'notifications';
}

async function handleNotificationClick(notification: AppNotification) {
  const user = currentUser.value;
  if (!user) {
    return;
  }

  if (!notification.read) {
    await markNotificationRead(user.uid, notification.id);
  }

  if (notification.listingId) {
    if (notification.type === 'meetup') {
      router.push(`/listing/${notification.listingId}`);
      return;
    }

    const userId = user.uid;
    const isSellerMessage =
      notification.type === 'message' && notification.actorId !== userId;
    const path = isSellerMessage
      ? `/inbox/listing/${notification.listingId}?buyerId=${encodeURIComponent(notification.actorId)}`
      : `/inbox/listing/${notification.listingId}`;
    router.push(path);
  }
}

function sellerThreadLink(thread: MessageThread): string {
  const userId = currentUser.value?.uid;
  const base = `/inbox/listing/${thread.listingId}`;

  if (
    userId &&
    thread.lastMessageSenderId &&
    thread.lastMessageSenderId !== userId
  ) {
    return `${base}?buyerId=${encodeURIComponent(thread.lastMessageSenderId)}`;
  }

  return base;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString();
}
</script>

<style scoped>
.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--ion-color-medium);
}

.hint {
  font-size: 0.9rem;
  line-height: 1.4;
}

.timestamp {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}
</style>
