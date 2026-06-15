<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>FirmShake</ion-title>
      </ion-toolbar>
      <ion-toolbar class="app-toolbar-content">
        <AppContentFrame>
          <div class="community-row">
            <ion-segment
              v-model="selectedCommunity"
              scrollable
              class="community-segment"
              @ionChange="onCommunityChange"
            >
              <ion-segment-button
                v-for="community in browseCommunities"
                :key="community.id"
                :value="community.id"
              >
                <ion-label>{{ community.name }}</ion-label>
              </ion-segment-button>
            </ion-segment>
            <ion-button
              fill="clear"
              class="add-community-btn"
              aria-label="Create community"
              router-link="/communities/create"
            >
              <ion-icon slot="icon-only" :icon="addOutline" />
            </ion-button>
          </div>
        </AppContentFrame>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <AppContentFrame>
        <div class="community-actions">
          <ion-button expand="block" :router-link="sellLink">
            Sell on {{ selectedCommunityName }}
          </ion-button>
        </div>

        <div v-if="loading" class="empty-state">
          <ion-spinner name="crescent" />
          <p>Loading listings...</p>
        </div>

        <div v-else-if="error" class="empty-state">
          <p>{{ error }}</p>
        </div>

        <ion-list v-else>
          <ion-item
            v-for="listing in listings"
            :key="listing.id"
            button
            :router-link="`/listing/${listing.id}`"
            detail
          >
            <ion-thumbnail slot="start">
              <AuthenticatedImage :src="listing.imageUrl" :alt="listing.title" />
            </ion-thumbnail>
            <ion-label>
              <h2>{{ listing.title }}</h2>
              <p>{{ formatPrice(listing.price) }} · {{ listing.sellerName }}</p>
              <p class="community-tags">{{ communityLabel(listing.communityIds) }}</p>
            </ion-label>
          </ion-item>
        </ion-list>

        <div v-if="!loading && !error" class="community-actions">
          <ion-button expand="block" fill="outline" :router-link="sellLink">
            Add Item To Sell
          </ion-button>
        </div>

        <div v-if="!loading && !error && listings.length === 0" class="empty-state">
          <p>No listings in this community yet.</p>
        </div>
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonThumbnail,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { addOutline } from 'ionicons/icons';

import { fetchCommunities, getCommunityName } from '@/services/communities';
import { subscribeListings } from '@/services/listings';
import AppContentFrame from '@/components/AppContentFrame.vue';
import AuthenticatedImage from '@/components/AuthenticatedImage.vue';
import { ALL_COMMUNITY_ID } from '@/data/seedCommunities';
import { currentUser } from '@/services/auth';
import { subscribeUserProfile } from '@/services/users';
import type { Community, Listing, UserProfile } from '@/types';

const allCommunities = ref<Community[]>([]);
const profile = ref<UserProfile | null>(null);
const listings = ref<Listing[]>([]);
const selectedCommunity = ref(ALL_COMMUNITY_ID);
const loading = ref(true);
const error = ref('');

const browseCommunities = computed(() => {
  const joinedIds = new Set(profile.value?.communityIds ?? [ALL_COMMUNITY_ID]);
  return allCommunities.value.filter((community) => joinedIds.has(community.id));
});

const selectedCommunityName = computed(
  () => getCommunityName(allCommunities.value, selectedCommunity.value) ?? 'All',
);

const sellLink = computed(() => ({
  path: '/tabs/sell',
  query: { community: selectedCommunity.value },
}));

let unsubscribeListings: (() => void) | undefined;
let unsubscribeProfile: (() => void) | undefined;

function startListingSubscription() {
  unsubscribeListings?.();
  loading.value = true;
  error.value = '';

  unsubscribeListings = subscribeListings(
    selectedCommunity.value,
    (nextListings) => {
      listings.value = nextListings;
      loading.value = false;
    },
    (subscriptionError) => {
      error.value = subscriptionError.message;
      loading.value = false;
    },
  );
}

onMounted(async () => {
  try {
    allCommunities.value = await fetchCommunities();

    const user = currentUser.value;
    if (user) {
      unsubscribeProfile = subscribeUserProfile(user.uid, (nextProfile) => {
        profile.value = nextProfile;
      });
    }

    startListingSubscription();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load communities';
    loading.value = false;
  }
});

watch(browseCommunities, (communities) => {
  if (!communities.some((community) => community.id === selectedCommunity.value)) {
    selectedCommunity.value = ALL_COMMUNITY_ID;
  }
});

watch(selectedCommunity, () => {
  startListingSubscription();
});

onUnmounted(() => {
  unsubscribeListings?.();
  unsubscribeProfile?.();
});

function onCommunityChange(event: CustomEvent) {
  selectedCommunity.value = event.detail.value;
}

function formatPrice(price: number): string {
  return price === 0 ? 'Free' : `$${price}`;
}

function communityLabel(communityIds: string[]): string {
  const names = communityIds
    .map((id) => getCommunityName(allCommunities.value, id))
    .filter(Boolean);
  return names.join(', ');
}
</script>

<style scoped>
.community-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.community-segment {
  flex: 1;
  min-width: 0;
}

.add-community-btn {
  flex-shrink: 0;
  margin: 0;
  --padding-start: 0.5rem;
  --padding-end: 0.5rem;
  font-size: 1.5rem;
}

.community-actions {
  padding: 0.75rem 0;
}

.community-tags {
  color: var(--ion-color-medium);
  font-size: 0.85rem;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--ion-color-medium);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
</style>
