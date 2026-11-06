<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <ion-tab-bar slot="bottom" class="app-chrome-full">
        <ion-tab-button tab="home" href="/tabs/home" @click.capture="onTabClick($event, '/tabs/home')">
          <ion-icon :icon="homeOutline" />
          <ion-label>Browse</ion-label>
        </ion-tab-button>

        <ion-tab-button
          tab="savedlistings"
          href="/tabs/savedlistings"
          @click.capture="onTabClick($event, '/tabs/savedlistings')"
        >
          <ion-icon :icon="bookmarkOutline" />
          <ion-label>Saved</ion-label>
        </ion-tab-button>

        <template v-if="showGuestTabBar">
          <ion-tab-button
            tab="login-create"
            href="/tabs/login-create"
            @click.capture="onTabClick($event, '/tabs/login-create')"
          >
            <ion-icon :icon="personCircleOutline" />
            <ion-label>Login/Create</ion-label>
          </ion-tab-button>
        </template>

        <template v-else>
          <ion-tab-button tab="buying" href="/tabs/buying" @click.capture="onTabClick($event, '/tabs/buying')">
            <ion-icon :icon="bagOutline" />
            <ion-label>Buying</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="selling" href="/tabs/selling" @click.capture="onTabClick($event, '/tabs/selling')">
            <ion-icon :icon="pricetagOutline" />
            <ion-label>Selling</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="inbox" href="/tabs/inbox" @click.capture="onTabClick($event, '/tabs/inbox')">
            <ion-icon :icon="chatbubbleOutline" />
            <ion-label>Inbox</ion-label>
          </ion-tab-button>
        </template>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { scheduleTabPrefetch } from '@/common/services/tabPrefetch';
import { authReady, currentUser } from '@/features/auth/services/auth';
import { MOBILE_WEB_MEDIA_QUERY } from '@/utils/platform';
import {
  IonIcon,
  IonLabel,
  IonPage,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  useIonRouter,
} from '@ionic/vue';
import {
  bagOutline,
  bookmarkOutline,
  chatbubbleOutline,
  homeOutline,
  personCircleOutline,
  pricetagOutline,
} from 'ionicons/icons';
import { debugLog } from '@/common/debug/debugLog';
import {
  guestTabFeatureLabel,
  isGuestProtectedTabPath,
  promptGuestSignIn,
} from '@/common/services/guestAuthUi';

const route = useRoute();
const ionRouter = useIonRouter();
const tabNavigationPending = ref(false);
const isMobileWebViewport = ref(false);

const isGuest = computed(() => authReady.value && !currentUser.value);

const showGuestTabBar = computed(
  () => isGuest.value && isMobileWebViewport.value,
);

let mobileWebMediaQuery: MediaQueryList | undefined;

function syncMobileWebViewport() {
  isMobileWebViewport.value = mobileWebMediaQuery?.matches ?? false;
}

onMounted(() => {
  const uid = currentUser.value?.uid;
  if (uid) {
    scheduleTabPrefetch(uid);
  }

  mobileWebMediaQuery = window.matchMedia(MOBILE_WEB_MEDIA_QUERY);
  syncMobileWebViewport();
  mobileWebMediaQuery.addEventListener('change', syncMobileWebViewport);
});

onUnmounted(() => {
  mobileWebMediaQuery?.removeEventListener('change', syncMobileWebViewport);
});

function normalizePath(path: string): string {
  return path.replace(/\/$/, '') || '/';
}

function releaseTabNavigationLock() {
  window.setTimeout(() => {
    tabNavigationPending.value = false;
  }, 200);
}

function onTabClick(event: Event, path: string) {
  const currentPath = normalizePath(route.path);
  const targetPath = normalizePath(path);

  if (isGuest.value && !isMobileWebViewport.value && isGuestProtectedTabPath(targetPath)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    void promptGuestSignIn(ionRouter, guestTabFeatureLabel(targetPath));
    return;
  }

  if (currentPath === targetPath) {
    event.preventDefault();
    return;
  }

  // Nested route within the same tab (e.g. /tabs/inbox/listing/:id): let Ionic
  // resetTab pop back to the tab root instead of fighting the view stack.
  if (currentPath.startsWith(`${targetPath}/`)) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();

  if (tabNavigationPending.value) {
    debugLog.debug('app', 'Tab click ignored: navigation already pending', {
      from: currentPath,
      to: targetPath,
    });
    return;
  }

  tabNavigationPending.value = true;
  debugLog.debug('app', 'Tab navigation', { from: currentPath, to: targetPath });

  try {
    ionRouter.navigate(path, 'root', 'replace');
  } catch (err) {
    tabNavigationPending.value = false;
    debugLog.warn('app', 'Tab navigation failed', { from: currentPath, to: targetPath, err });
    throw err;
  }

  releaseTabNavigationLock();
}
</script>

