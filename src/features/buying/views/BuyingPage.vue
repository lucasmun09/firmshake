<template>
  <ion-page>
    <AppTopToolbar title="Buying">
      <AppTabRefreshingIndicator :active="refreshing" />
    </AppTopToolbar>

    <ion-content ref="contentRef" class="app-tab-content" @ionScroll="onScroll">
      <AppContentFrame>
        <div v-if="error" class="empty-state">
          <p>{{ error }}</p>
          <ion-button fill="outline" @click="retryLoad">Try again</ion-button>
        </div>

        <AppTabLoadingState v-else-if="loading && buyerThreads.length === 0" />

        <div v-else-if="showTrulyEmpty" class="empty-state">
          <p>No active buying conversations.</p>
          <p class="hint">Message a seller from a listing to start negotiating.</p>
          <ion-button router-link="/tabs/home" fill="outline">Browse listings</ion-button>
        </div>

        <template v-else>
          <ion-list v-if="activeThreads.length > 0">
            <ion-item
              v-for="thread in visibleItems"
              :key="thread.listingId"
              button
              @click="openThread(thread.listingId)"
            >
              <ion-thumbnail slot="start">
                <AuthenticatedImage
                  :src="thread.listingImageUrl"
                  :alt="thread.listingTitle"
                  variant="thumbnail"
                />
              </ion-thumbnail>
              <ion-label>
                <div class="title-row">
                  <h2>{{ thread.listingTitle }}</h2>
                  <span v-if="isListingDelisted(thread)" class="delisted-label">Item Delisted</span>
                </div>
                <p v-if="thread.sellerName">Seller: {{ thread.sellerName }}</p>
                <p>{{ thread.lastMessageSenderName }}: {{ thread.lastMessageText }}</p>
                <p v-if="firmShakeState(thread.listingId).label" class="firmshake-label">
                  {{ firmShakeState(thread.listingId).label }}
                </p>
                <ListingThreadActions
                  :listing-id="thread.listingId"
                  role="buyer"
                  :firm-shake-kind="firmShakeState(thread.listingId).kind"
                  :listing-delisted="isListingDelisted(thread)"
                />
              </ion-label>
              <ConversationOverflowMenu
                slot="end"
                :listing-id="thread.listingId"
                :is-archived="false"
              />
            </ion-item>

            <ThreadRowSkeleton
              v-for="index in trailingSkeletonCount"
              :key="`trailing-${index}`"
            />
          </ion-list>

          <TabArchivedSection
            v-if="allItemsRevealed || activeThreads.length === 0"
            v-model:expanded="showArchived"
            :has-archived="archivedThreads.length > 0"
            header-label="Archived Items"
          >
            <ion-list>
              <ion-item
                v-for="thread in archivedThreads"
                :key="`archived-${thread.listingId}`"
                button
                @click="openThread(thread.listingId)"
              >
                <ion-thumbnail slot="start">
                  <AuthenticatedImage
                    :src="thread.listingImageUrl"
                    :alt="thread.listingTitle"
                    variant="thumbnail"
                  />
                </ion-thumbnail>
                <ion-label>
                  <div class="title-row">
                    <h2>{{ thread.listingTitle }}</h2>
                    <span v-if="isListingDelisted(thread)" class="delisted-label">Item Delisted</span>
                  </div>
                  <p v-if="thread.sellerName">Seller: {{ thread.sellerName }}</p>
                  <p>{{ thread.lastMessageSenderName }}: {{ thread.lastMessageText }}</p>
                  <ListingThreadActions
                    :listing-id="thread.listingId"
                    role="buyer"
                    :firm-shake-kind="firmShakeState(thread.listingId).kind"
                    :listing-delisted="isListingDelisted(thread)"
                  />
                </ion-label>
                <ConversationOverflowMenu
                  slot="end"
                  :listing-id="thread.listingId"
                  :is-archived="true"
                />
              </ion-item>
            </ion-list>
          </TabArchivedSection>
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
  IonButton,
  IonContent,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonThumbnail,
} from '@ionic/vue';

import AppContentFrame from '@/components/AppContentFrame.vue';
import AppTabLoadingState from '@/components/AppTabLoadingState.vue';
import AppTabRefreshingIndicator from '@/components/AppTabRefreshingIndicator.vue';
import AppTopToolbar from '@/components/AppTopToolbar.vue';
import AuthenticatedImage from '@/components/AuthenticatedImage.vue';
import ConversationOverflowMenu from '@/features/messages/components/ConversationOverflowMenu.vue';
import ListingThreadActions from '@/features/messages/components/ListingThreadActions.vue';
import TabArchivedSection from '@/features/messages/components/TabArchivedSection.vue';
import ThreadRowSkeleton from '@/components/skeletons/ThreadRowSkeleton.vue';
import { useLazyReveal } from '@/common/composables/useLazyReveal';
import { useTabFeedLoader } from '@/common/composables/useTabFeedLoader';
import { debugLog, serializeError } from '@/common/debug/debugLog';
import {
  getBuyerListingFirmShakeState,
  groupAgreementsByListing,
  subscribeBuyerAgreements,
} from '@/common/services/agreements';
import {
  getCachedInboxThreads,
  getStaleInboxThreads,
  setCachedInboxThreads,
} from '@/common/services/tabFeedCache';
import { waitForFirestoreAuth } from '@/common/services/firestoreAuth';
import { currentUser } from '@/features/auth/services/auth';
import { SESSION_EXPIRED_MESSAGE } from '@/features/auth/services/sessionExpiry';
import {
  partitionByArchive,
  subscribeInboxStates,
} from '@/features/messages/services/inboxState';
import { subscribeInboxThreadsRouted } from '@/features/messages/services/inboxServiceRouter';
import type { Agreement, InboxState, MessageThread } from '@/types';

const router = useRouter();

const {
  loading,
  refreshing,
  error,
  beginLoad,
  finishLoad,
  failLoad,
  hydrateFromCache,
  startLoadingSpinner,
  cancelLoad,
  isCurrentGeneration,
} = useTabFeedLoader('buying');
const threads = ref<MessageThread[]>([]);
const agreements = ref<Agreement[]>([]);
const inboxStates = ref<Map<string, InboxState>>(new Map());
const showArchived = ref(false);
const contentRef = ref<InstanceType<typeof IonContent> | null>(null);

const buyerThreads = computed(() => {
  const userId = currentUser.value?.uid;
  if (!userId) {
    return [];
  }

  return threads.value.filter(
    (thread) => thread.sellerId && thread.sellerId !== userId,
  );
});

const activeThreads = computed(() =>
  partitionByArchive(buyerThreads.value, inboxStates.value).active,
);

const archivedThreads = computed(() =>
  partitionByArchive(buyerThreads.value, inboxStates.value).archived,
);

const showTrulyEmpty = computed(
  () => !loading.value && buyerThreads.value.length === 0,
);

const agreementsByListing = computed(() => groupAgreementsByListing(agreements.value));

const {
  visibleItems,
  trailingSkeletonCount,
  allItemsRevealed,
  onScroll,
} = useLazyReveal(activeThreads, { contentRef, loading });

let unsubscribeThreads: (() => void) | undefined;
let unsubscribeAgreements: (() => void) | undefined;
let unsubscribeInboxStates: (() => void) | undefined;

function listingAgreements(listingId: string): Agreement[] {
  return agreementsByListing.value.get(listingId) ?? [];
}

function firmShakeState(listingId: string) {
  return getBuyerListingFirmShakeState(listingAgreements(listingId));
}

function isListingDelisted(thread: MessageThread): boolean {
  return thread.listingStatus === 'removed';
}

function openThread(listingId: string) {
  void router.push(`/tabs/buying/listing/${listingId}`);
}

function hydratePlaceholder(uid: string): boolean {
  return hydrateFromCache(
    () => getStaleInboxThreads(uid) ?? getCachedInboxThreads(uid),
    (cached) => {
      threads.value = cached;
    },
    uid,
  );
}

async function loadBuying() {
  const generation = beginLoad();

  const hadPlaceholder = currentUser.value?.uid
    ? hydratePlaceholder(currentUser.value.uid)
    : false;

  if (!hadPlaceholder) {
    startLoadingSpinner();
  }

  debugLog.debug('buying', 'Load start', {
    generation,
    hadPlaceholder,
    placeholderCount: threads.value.length,
  });

  try {
    const user = currentUser.value;
    if (!user) {
      failLoad(generation, 'You must be signed in to view buying activity.');
      return;
    }

    unsubscribeThreads?.();
    unsubscribeAgreements?.();
    unsubscribeInboxStates?.();

    unsubscribeThreads = subscribeInboxThreadsRouted(
      user.uid,
      (nextThreads) => {
        if (!isCurrentGeneration(generation)) {
          return;
        }
        threads.value = nextThreads;
        setCachedInboxThreads(user.uid, nextThreads);
        finishLoad(generation, nextThreads.length === 0 ? 'empty' : 'threads');
        debugLog.debug('buying', 'Threads loaded', {
          generation,
          uid: user.uid,
          total: nextThreads.length,
          buyerCount: buyerThreads.value.length,
        });
      },
      (loadError) => {
        const message = loadError.message.includes('session')
          ? SESSION_EXPIRED_MESSAGE
          : 'Could not load your buying conversations.';
        if (buyerThreads.value.length === 0) {
          failLoad(generation, message, loadError);
        } else {
          finishLoad(generation, 'partial-after-error');
        }
      },
    );

    unsubscribeAgreements = subscribeBuyerAgreements(
      user.uid,
      (nextAgreements) => {
        agreements.value = nextAgreements;
      },
      (loadError) => {
        debugLog.warn('buying', 'Agreements subscription failed', {
          error: serializeError(loadError),
        });
      },
    );

    unsubscribeInboxStates = subscribeInboxStates(user.uid, (states) => {
      inboxStates.value = states;
    });

    void waitForFirestoreAuth().catch((err) => {
      if (!isCurrentGeneration(generation)) {
        return;
      }
      if (err instanceof Error && err.message.includes('session')) {
        failLoad(generation, SESSION_EXPIRED_MESSAGE, err);
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not load your buying conversations.';
    failLoad(generation, message, err);
  }
}

function retryLoad() {
  void loadBuying();
}

onIonViewWillEnter(() => {
  void loadBuying();
});

const setupUid = currentUser.value?.uid;
if (setupUid) {
  hydratePlaceholder(setupUid);
}

onUnmounted(() => {
  cancelLoad();
  unsubscribeThreads?.();
  unsubscribeAgreements?.();
  unsubscribeInboxStates?.();
});
</script>

<style scoped>
.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--ion-color-medium);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.hint {
  font-size: 0.9rem;
  line-height: 1.4;
}

.firmshake-label {
  color: var(--ion-color-primary);
  font-size: 0.85rem;
  font-weight: 600;
}

.title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.title-row h2 {
  margin: 0;
}

.delisted-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ion-color-warning);
  white-space: nowrap;
}
</style>
