<template>
  <ion-page>
    <AppTopToolbar
      :title="toolbarTitle"
      show-back-button
      back-href="/tabs/home"
    />

    <ion-content class="app-tab-content">
      <AppContentFrame>
        <div v-if="loading" class="centered" aria-busy="true">
          <ion-spinner name="crescent" />
        </div>

        <div v-else class="seller-profile app-section-stack">
          <header class="seller-profile__header">
            <UserAvatar
              size="lg"
              :name="profile.displayName"
              :photo-url="profile.photoUrl"
            />
            <div>
              <h1 data-testid="seller-display-name">{{ profile.displayName }}</h1>
              <p class="seller-profile__meta">
                {{ profile.activeListingCount }}
                active {{ profile.activeListingCount === 1 ? 'listing' : 'listings' }}
              </p>
            </div>
          </header>

          <section v-if="listings.length === 0" class="empty-state">
            <p>This seller has no active listings right now.</p>
          </section>

          <BrowseCardsView v-else :listings="summaryListings" />
        </div>
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { IonContent, IonPage, IonSpinner } from '@ionic/vue';

import AppContentFrame from '@/components/AppContentFrame.vue';
import AppTopToolbar from '@/components/AppTopToolbar.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { debugLog, serializeError } from '@/common/debug/debugLog';
import { getPublicUserViaBff, isApiConfigured } from '@/common/services/api';
import { getUserProfile } from '@/common/services/users';
import { authReady, currentUser } from '@/features/auth/services/auth';
import BrowseCardsView from '@/features/listings/components/BrowseCardsView.vue';
import { subscribeSellerListings } from '@/features/listings/services/listings';
import { summarizeListings } from '@/features/listings/utils/listingSummary';
import { sellerProfileFromListings } from '@/features/listings/utils/sellerPublicProfile';
import { formatDocumentTitle } from '@/router/pageTitle';
import type { Listing } from '@/types';

const route = useRoute();
const sellerId = computed(() => String(route.params.sellerId ?? '').trim());
const listings = ref<Listing[]>([]);
const loading = ref(true);
const profileName = ref<string | undefined>();
const profilePhotoUrl = ref<string | undefined>();

const profile = computed(() =>
  sellerProfileFromListings(sellerId.value, listings.value, {
    displayName: profileName.value,
    photoUrl: profilePhotoUrl.value,
  }),
);

const summaryListings = computed(() => summarizeListings(listings.value));
const toolbarTitle = computed(() => profile.value.displayName || 'Seller');

let unsubscribeListings: (() => void) | undefined;

async function enrichSellerHeader(uid: string) {
  try {
    if (isApiConfigured()) {
      const publicProfile = await getPublicUserViaBff(uid);
      profileName.value = publicProfile.displayName;
      profilePhotoUrl.value = publicProfile.photoUrl ?? undefined;
      return;
    }

    if (!currentUser.value) {
      return;
    }

    const userProfile = await getUserProfile(uid);
    if (!userProfile) {
      return;
    }
    profileName.value = userProfile.displayName;
    profilePhotoUrl.value = userProfile.photoUrl;
  } catch (error) {
    debugLog.warn('seller-profile', 'enrich.failed', {
      sellerId: uid,
      error: serializeError(error),
    });
  }
}

function subscribe(uid: string) {
  unsubscribeListings?.();
  loading.value = true;
  listings.value = [];
  profileName.value = undefined;
  profilePhotoUrl.value = undefined;

  debugLog.info('seller-profile', 'load.start', { sellerId: uid });
  void enrichSellerHeader(uid);

  unsubscribeListings = subscribeSellerListings(
    uid,
    (next) => {
      listings.value = next;
      loading.value = false;
      debugLog.info('seller-profile', 'load.listings', {
        sellerId: uid,
        count: next.length,
      });
    },
    (error) => {
      loading.value = false;
      debugLog.error('seller-profile', 'load.failed', {
        sellerId: uid,
        error: serializeError(error),
      });
    },
  );
}

watch(
  () => profile.value.displayName,
  (name) => {
    document.title = formatDocumentTitle(name);
  },
  { immediate: true },
);

watch(sellerId, (uid) => {
  if (uid) {
    subscribe(uid);
  }
});

watch(authReady, (ready) => {
  if (ready && sellerId.value) {
    void enrichSellerHeader(sellerId.value);
  }
});

onMounted(() => {
  if (sellerId.value) {
    subscribe(sellerId.value);
  } else {
    loading.value = false;
  }
});

onUnmounted(() => {
  unsubscribeListings?.();
});
</script>

<style scoped>
.centered {
  display: grid;
  place-items: center;
  min-height: 12rem;
}

.seller-profile__header {
  display: flex;
  align-items: center;
  gap: var(--fs-space-md);
}

.seller-profile__header h1 {
  margin: 0;
  font-size: 1.35rem;
}

.seller-profile__meta {
  margin: 0.25rem 0 0;
  color: var(--ion-color-medium);
}

.empty-state {
  padding: var(--fs-space-xl) 0;
  color: var(--ion-color-medium);
}
</style>
