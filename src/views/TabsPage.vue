<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <ion-tab-bar slot="bottom" class="app-chrome-full">
        <ion-tab-button tab="home" href="/tabs/home">
          <ion-icon :icon="homeOutline" />
          <ion-label>Browse</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="communities" href="/tabs/communities">
          <ion-icon :icon="peopleOutline" />
          <ion-label>Communities</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="inbox" href="/tabs/inbox">
          <ion-icon :icon="chatbubblesOutline" />
          <ion-label>Inbox</ion-label>
          <ion-badge v-if="unreadCount > 0" color="danger">{{ unreadCount }}</ion-badge>
        </ion-tab-button>
        <ion-tab-button tab="sell" href="/tabs/sell">
          <ion-icon :icon="addCircleOutline" />
          <ion-label>Sell</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="profile" href="/tabs/profile">
          <ion-icon :icon="personOutline" />
          <ion-label>Profile</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  IonBadge,
  IonIcon,
  IonLabel,
  IonPage,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/vue';
import { addCircleOutline, chatbubblesOutline, homeOutline, peopleOutline, personOutline } from 'ionicons/icons';

import { currentUser } from '@/services/auth';
import { subscribeUnreadNotificationCount } from '@/services/notifications';

const unreadNotifications = ref(0);

const unreadCount = computed(() => unreadNotifications.value);

let unsubscribeNotifications: (() => void) | undefined;

onMounted(() => {
  const user = currentUser.value;
  if (!user) {
    return;
  }

  unsubscribeNotifications = subscribeUnreadNotificationCount(user.uid, (count) => {
    unreadNotifications.value = count;
  });
});

onUnmounted(() => {
  unsubscribeNotifications?.();
});
</script>
