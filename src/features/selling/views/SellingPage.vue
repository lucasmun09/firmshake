<template>
  <ion-page>
    <AppTopToolbar title="Selling">
      <AppTabRefreshingIndicator :active="refreshing" />
    </AppTopToolbar>

    <ion-content ref="contentRef" class="app-tab-content" @ionScroll="onScroll">
      <AppContentFrame>
        <div v-if="error" class="empty-state">
          <p>{{ error }}</p>
          <ion-button fill="outline" @click="retryLoad">Try again</ion-button>
        </div>

        <AppTabLoadingState v-else-if="loading && listings.length === 0" />

        <div v-else-if="showTrulyEmpty" class="empty-state">
          <p>You are not selling anything yet.</p>
          <ion-button router-link="/tabs/sell" fill="outline">Post a listing</ion-button>
        </div>

        <template v-else>
          <ion-list>
            <ion-item
              v-for="listing in visibleItems"
              :key="listing.id"
              button
              @click="openThread(listing.id)"
            >
              <ion-thumbnail slot="start">
                <AuthenticatedImage
                  :src="listing.imageUrl"
                  :alt="listing.title"
                  variant="thumbnail"
                />
              </ion-thumbnail>
              <ion-label>
                <h2>{{ listing.title }}</h2>
                <p>{{ formatPrice(listing.price) }} · {{ getCategoryName(categories, listing.primaryCategoryId) }}</p>
                <p v-if="buyerCount(listing.id) > 0" class="buyer-count">
                  {{ buyerCount(listing.id) }}
                  {{ buyerCount(listing.id) === 1 ? 'buyer' : 'buyers' }} reached out
                </p>
                <p v-if="threadPreview(listing.id)" class="thread-preview">
                  {{ threadPreview(listing.id) }}
                </p>
                <p
                  v-if="firmShakeState(listing.id).kind === 'accepted'"
                  class="firmshake-label"
                >
                  FirmShake Accepted
                </p>
                <p
                  v-for="agreement in firmShakeState(listing.id).proposedAgreements"
                  :key="agreement.id"
                  class="firmshake-label"
                >
                  FirmShake Received from {{ agreement.buyerName }}
                </p>
                <p
                  v-if="
                    firmShakeState(listing.id).kind === 'declined' &&
                    firmShakeState(listing.id).proposedAgreements.length === 0
                  "
                  class="firmshake-label declined"
                >
                  {{ firmShakeState(listing.id).label }}
                </p>
                <ListingThreadActions
                  :listing-id="listing.id"
                  role="seller"
                  :firm-shake-kind="firmShakeState(listing.id).kind"
                />
              </ion-label>
            </ion-item>

            <ListingRowSkeleton
              v-for="index in trailingSkeletonCount"
              :key="`trailing-${index}`"
            />
          </ion-list>

          <TabArchivedSection
            v-if="allItemsRevealed"
            v-model:expanded="showArchived"
            :has-archived="archivedSellerThreads.length > 0"
            header-label="Archived Items"
          >
            <ion-list>
              <ion-item
                v-for="thread in archivedSellerThreads"
                :key="`archived-${thread.id}`"
                button
                @click="openArchivedThread(thread)"
              >
                <ion-thumbnail slot="start">
                  <AuthenticatedImage
                    :src="thread.listingImageUrl"
                    :alt="thread.listingTitle"
                    variant="thumbnail"
                  />
                </ion-thumbnail>
                <ion-label>
                  <h2>{{ thread.listingTitle }}</h2>
                  <p class="buyer-name">{{ thread.buyerName ?? 'Buyer' }}</p>
                  <p class="thread-preview">
                    {{ formatArchivedPreview(thread) }}
                  </p>
                </ion-label>
                <ConversationOverflowMenu
                  slot="end"
                  :listing-id="thread.listingId"
                  :buyer-id="thread.buyerId"
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
import { formatPrice } from '@/utils/currency';
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
import ListingRowSkeleton from '@/components/skeletons/ListingRowSkeleton.vue';
import { useLazyReveal } from '@/common/composables/useLazyReveal';
import { useTabFeedLoader } from '@/common/composables/useTabFeedLoader';
import { debugLog, serializeError } from '@/common/debug/debugLog';
import {
  countListingBuyerOutreach,
  getSellerListingFirmShakeState,
  getSellerListingSortPriority,
  groupAgreementsByListing,
  subscribeSellerAgreements,
} from '@/common/services/agreements';
import {
  getCachedSellingListings,
  getStaleSellingListings,
  setCachedSellingListings,
} from '@/common/services/tabFeedCache';
import { waitForFirestoreAuth } from '@/common/services/firestoreAuth';
import { currentUser } from '@/features/auth/services/auth';
import { SESSION_EXPIRED_MESSAGE } from '@/features/auth/services/sessionExpiry';
import { fetchCategories, getCategoryName } from '@/features/listings/services/categories';
import { subscribeSellerListings } from '@/features/listings/services/listings';
import {
  partitionByArchive,
  subscribeInboxStates,
} from '@/features/messages/services/inboxState';
import { subscribeInboxThreadsRouted } from '@/features/messages/services/inboxServiceRouter';
import type { Agreement, Category, InboxState, Listing, MessageThread } from '@/types';

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
} = useTabFeedLoader('selling');
const listings = ref<Listing[]>([]);
const threads = ref<MessageThread[]>([]);
const agreements = ref<Agreement[]>([]);
const categories = ref<Category[]>([]);
const inboxStates = ref<Map<string, InboxState>>(new Map());
const showArchived = ref(false);
const contentRef = ref<InstanceType<typeof IonContent> | null>(null);

const agreementsByListing = computed(() => groupAgreementsByListing(agreements.value));

const sellerThreads = computed(() => {
  const userId = currentUser.value?.uid;
  if (!userId) {
    return [];
  }
  return threads.value.filter(
    (thread) => thread.sellerId === userId && thread.buyerId,
  );
});

const activeSellerThreads = computed(() =>
  partitionByArchive(sellerThreads.value, inboxStates.value).active,
);

const archivedSellerThreads = computed(() =>
  partitionByArchive(sellerThreads.value, inboxStates.value).archived,
);

const showTrulyEmpty = computed(
  () => !loading.value && listings.value.length === 0,
);

const sortedListings = computed(() => {
  return [...listings.value].sort((left, right) => {
    const leftPriority = getSellerListingSortPriority(
      firmShakeState(left.id).kind,
    );
    const rightPriority = getSellerListingSortPriority(
      firmShakeState(right.id).kind,
    );

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.title.localeCompare(right.title);
  });
});

const {
  visibleItems,
  trailingSkeletonCount,
  allItemsRevealed,
  onScroll,
} = useLazyReveal(sortedListings, { contentRef, loading });

const activeThreadsByListing = computed(() => {
  const grouped = new Map<string, MessageThread[]>();
  for (const thread of activeSellerThreads.value) {
    const existing = grouped.get(thread.listingId) ?? [];
    existing.push(thread);
    grouped.set(thread.listingId, existing);
  }
  return grouped;
});

let unsubscribeListings: (() => void) | undefined;
let unsubscribeThreads: (() => void) | undefined;
let unsubscribeAgreements: (() => void) | undefined;
let unsubscribeInboxStates: (() => void) | undefined;

function listingAgreements(listingId: string): Agreement[] {
  return agreementsByListing.value.get(listingId) ?? [];
}

function firmShakeState(listingId: string) {
  return getSellerListingFirmShakeState(listingAgreements(listingId));
}

function threadPreview(listingId: string): string | null {
  const listingThreads = activeThreadsByListing.value.get(listingId) ?? [];
  const thread = listingThreads.sort(
    (left, right) =>
      (right.lastMessageAt?.getTime() ?? 0) - (left.lastMessageAt?.getTime() ?? 0),
  )[0];

  if (!thread?.lastMessageText) {
    return null;
  }

  const prefix =
    thread.lastMessageSenderId === currentUser.value?.uid
      ? 'You: '
      : `${thread.lastMessageSenderName}: `;
  return `${prefix}${thread.lastMessageText}`;
}

function buyerCount(listingId: string): number {
  const activeThreads = activeSellerThreads.value.filter(
    (thread) => thread.listingId === listingId,
  );
  return countListingBuyerOutreach(listingId, activeThreads, listingAgreements(listingId));
}

function formatArchivedPreview(thread: MessageThread): string {
  const prefix =
    thread.lastMessageSenderId === currentUser.value?.uid
      ? 'You: '
      : `${thread.lastMessageSenderName}: `;
  return `${prefix}${thread.lastMessageText}`;
}

function openThread(listingId: string) {
  void router.push(`/tabs/selling/listing/${listingId}`);
}

function openArchivedThread(thread: MessageThread) {
  const buyerQuery = thread.buyerId
    ? `?buyerId=${encodeURIComponent(thread.buyerId)}`
    : '';
  void router.push(`/tabs/selling/listing/${thread.listingId}${buyerQuery}`);
}

function hydratePlaceholder(uid: string): boolean {
  return hydrateFromCache(
    () => getStaleSellingListings(uid) ?? getCachedSellingListings(uid),
    (cached) => {
      listings.value = cached;
    },
    uid,
  );
}

async function loadSelling() {
  const generation = beginLoad();

  const hadPlaceholder = currentUser.value?.uid
    ? hydratePlaceholder(currentUser.value.uid)
    : false;

  if (!hadPlaceholder) {
    startLoadingSpinner();
  }

  debugLog.debug('selling', 'Load start', {
    generation,
    hadPlaceholder,
    placeholderCount: listings.value.length,
  });

  try {
    const user = currentUser.value;
    if (!user) {
      failLoad(generation, 'You must be signed in to view selling activity.');
      return;
    }

    unsubscribeListings?.();
    unsubscribeThreads?.();
    unsubscribeAgreements?.();
    unsubscribeInboxStates?.();

    void fetchCategories().then((nextCategories) => {
      if (isCurrentGeneration(generation)) {
        categories.value = nextCategories;
      }
    });

    unsubscribeListings = subscribeSellerListings(
      user.uid,
      (nextListings) => {
        if (!isCurrentGeneration(generation)) {
          return;
        }
        listings.value = nextListings;
        setCachedSellingListings(user.uid, nextListings);
        finishLoad(generation, nextListings.length === 0 ? 'empty' : 'listings');
        debugLog.debug('selling', 'Listings loaded', {
          generation,
          uid: user.uid,
          count: nextListings.length,
        });
      },
      (loadError) => {
        const message = loadError.message.includes('session')
          ? SESSION_EXPIRED_MESSAGE
          : 'Could not load your listings.';
        if (listings.value.length === 0) {
          failLoad(generation, message, loadError);
        } else {
          finishLoad(generation, 'partial-after-error');
        }
      },
    );

    unsubscribeThreads = subscribeInboxThreadsRouted(user.uid, {
      onData: (nextThreads) => {
        threads.value = nextThreads.filter((thread) => thread.sellerId === user.uid);
      },
      onError: (loadError) => {
        debugLog.warn('selling', 'Threads subscription failed', {
          error: serializeError(loadError),
        });
      },
      onInboxStates: (states) => {
        if (states.size === 0) {
          return;
        }
        if (inboxStates.value.size === 0) {
          inboxStates.value = states;
        }
      },
    });

    unsubscribeAgreements = subscribeSellerAgreements(
      user.uid,
      (nextAgreements) => {
        agreements.value = nextAgreements;
      },
      (loadError) => {
        debugLog.warn('selling', 'Agreements subscription failed', {
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
    const message = err instanceof Error ? err.message : 'Could not load your listings.';
    failLoad(generation, message, err);
  }
}

function retryLoad() {
  void loadSelling();
}

onIonViewWillEnter(() => {
  void loadSelling();
});

const setupUid = currentUser.value?.uid;
if (setupUid) {
  hydratePlaceholder(setupUid);
}

onUnmounted(() => {
  cancelLoad();
  unsubscribeListings?.();
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

.thread-preview {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.buyer-count {
  color: var(--ion-color-secondary);
  font-size: 0.85rem;
  font-weight: 600;
}

.buyer-name {
  color: var(--ion-color-primary);
  font-weight: 600;
}

.firmshake-label {
  color: var(--ion-color-primary);
  font-size: 0.85rem;
  font-weight: 600;
}

.firmshake-label.declined {
  color: var(--ion-color-medium);
}
</style>
