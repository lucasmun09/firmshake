<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Communities</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <AppContentFrame>
        <h3 class="section-title">Find a community</h3>
        <p class="section-hint">
          Enter a community name to join. If it does not exist yet, you can create it.
        </p>

        <form class="search-form" @submit.prevent="handleSearch">
          <ion-item>
            <ion-input
              v-model="searchName"
              label="Community name"
              label-placement="stacked"
              placeholder="e.g. Bay Area Climbers"
              required
            />
          </ion-item>
          <ion-button expand="block" type="submit" :disabled="searching || !searchName.trim()">
            {{ searching ? 'Searching...' : 'Search' }}
          </ion-button>
        </form>

        <div v-if="searchResult === 'found'" class="search-result">
          <p>
            <strong>{{ matchedCommunity?.name }}</strong> exists.
            <span v-if="isJoined(matchedCommunity!.id)">You are already a member.</span>
          </p>
          <p class="community-description">{{ matchedCommunity?.description }}</p>
          <ion-button
            v-if="!isJoined(matchedCommunity!.id)"
            expand="block"
            :disabled="communityBusy === matchedCommunity!.id"
            @click="handleJoin(matchedCommunity!.id)"
          >
            Join {{ matchedCommunity?.name }}
          </ion-button>
        </div>

        <div v-else-if="searchResult === 'not-found'" class="search-result">
          <p>
            No community named <strong>{{ lastSearchName }}</strong> was found.
          </p>
          <ion-button
            expand="block"
            :router-link="createCommunityLink"
          >
            Create community
          </ion-button>
        </div>

        <h3 class="section-title">My communities</h3>
        <p class="section-hint">ALL is always available. Leave any other community at any time.</p>

        <ion-list>
          <ion-item v-for="community in joinedCommunities" :key="community.id">
            <ion-label>
              <h3>{{ community.name }}</h3>
              <p>{{ community.description }}</p>
            </ion-label>
            <ion-badge v-if="community.id === ALL_COMMUNITY_ID" slot="end" color="primary">
              Always on
            </ion-badge>
            <ion-button
              v-else
              slot="end"
              fill="outline"
              color="medium"
              size="small"
              :disabled="communityBusy === community.id"
              @click="handleLeave(community.id)"
            >
              Leave
            </ion-button>
          </ion-item>
        </ion-list>

        <div v-if="joinedCommunities.length === 0" class="empty-state">
          <p>You have not joined any communities yet.</p>
        </div>

        <h3 class="section-title">Create a community</h3>
        <ion-button expand="block" router-link="/communities/create">
          Create community
        </ion-button>
      </AppContentFrame>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { onIonViewWillEnter } from '@ionic/vue';
import {
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue';

import AppContentFrame from '@/components/AppContentFrame.vue';
import { ALL_COMMUNITY_ID } from '@/data/seedCommunities';
import { currentUser } from '@/services/auth';
import { fetchCommunities, findCommunityByName } from '@/services/communities';
import { joinCommunity, leaveCommunity, subscribeUserProfile } from '@/services/users';
import type { Community, UserProfile } from '@/types';

const communities = ref<Community[]>([]);
const profile = ref<UserProfile | null>(null);
const searchName = ref('');
const lastSearchName = ref('');
const searching = ref(false);
const searchResult = ref<'found' | 'not-found' | null>(null);
const matchedCommunity = ref<Community | null>(null);
const communityBusy = ref('');

let unsubscribeProfile: (() => void) | undefined;

const joinedCommunities = computed(() => {
  const joinedIds = new Set(profile.value?.communityIds ?? [ALL_COMMUNITY_ID]);
  return communities.value.filter((community) => joinedIds.has(community.id));
});

const createCommunityLink = computed(() => {
  if (!lastSearchName.value) {
    return '/communities/create';
  }

  return {
    path: '/communities/create',
    query: { name: lastSearchName.value },
  };
});

onMounted(async () => {
  await refreshCommunities();

  const user = currentUser.value;
  if (user) {
    unsubscribeProfile = subscribeUserProfile(user.uid, (nextProfile) => {
      profile.value = nextProfile;
    });
  }
});

onIonViewWillEnter(() => {
  void refreshCommunities();
});

async function refreshCommunities() {
  communities.value = await fetchCommunities();
}

onUnmounted(() => {
  unsubscribeProfile?.();
});

function isJoined(communityId: string): boolean {
  if (communityId === ALL_COMMUNITY_ID) return true;
  return profile.value?.communityIds.includes(communityId) ?? false;
}

async function handleSearch() {
  const query = searchName.value.trim();
  if (!query) return;

  searching.value = true;
  searchResult.value = null;
  matchedCommunity.value = null;
  lastSearchName.value = query;

  try {
    const community = await findCommunityByName(query);
    if (community) {
      matchedCommunity.value = community;
      searchResult.value = 'found';
    } else {
      searchResult.value = 'not-found';
    }
  } catch (err) {
    await showError(err instanceof Error ? err.message : 'Could not search communities');
  } finally {
    searching.value = false;
  }
}

async function handleJoin(communityId: string) {
  const user = currentUser.value;
  if (!user) return;

  communityBusy.value = communityId;

  try {
    await joinCommunity(user.uid, communityId);
    await refreshCommunities();
    await showSuccess('Joined community');
    searchResult.value = null;
    searchName.value = '';
  } catch (err) {
    await showError(err instanceof Error ? err.message : 'Could not join community');
  } finally {
    communityBusy.value = '';
  }
}

async function handleLeave(communityId: string) {
  const user = currentUser.value;
  if (!user || communityId === ALL_COMMUNITY_ID) return;

  communityBusy.value = communityId;

  try {
    await leaveCommunity(user.uid, communityId);
    await showSuccess('Left community');
  } catch (err) {
    await showError(err instanceof Error ? err.message : 'Could not leave community');
  } finally {
    communityBusy.value = '';
  }
}

async function showSuccess(message: string) {
  const toast = await toastController.create({
    message,
    duration: 2000,
    color: 'success',
  });
  await toast.present();
}

async function showError(message: string) {
  const toast = await toastController.create({
    message,
    duration: 2500,
    color: 'danger',
  });
  await toast.present();
}
</script>

<style scoped>
.section-title {
  margin: 0 0 0.25rem;
}

.section-hint {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
  margin: 0 0 0.75rem;
}

.search-form {
  margin-bottom: 1rem;
}

.search-result {
  margin-bottom: 1.5rem;
  padding: 0.75rem 0;
}

.community-description {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.empty-state {
  color: var(--ion-color-medium);
  text-align: center;
  padding: 1rem 0;
}
</style>
