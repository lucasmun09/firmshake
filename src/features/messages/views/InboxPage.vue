<template>
  <ion-page>
    <AppTopToolbar title="Inbox">
      <AppTabRefreshingIndicator :active="refreshing" />
    </AppTopToolbar>

    <ion-content ref="contentRef" class="app-tab-content" @ionScroll="onScroll">
      <AppContentFrame>
        <div v-if="error" class="empty-state">
          <p>{{ error }}</p>
          <ion-button fill="outline" @click="retryLoad">Try again</ion-button>
        </div>

        <AppTabLoadingState v-else-if="loading && inboxRows.length === 0" />

        <div v-else-if="showTrulyEmpty" class="empty-state">
          <p>No messages yet.</p>
          <p class="hint">Message a seller from a listing to start a conversation.</p>
          <ion-button router-link="/tabs/home" fill="outline">Browse listings</ion-button>
        </div>

        <template v-else>
          <ion-list>
            <ion-item
              v-for="row in visibleItems"
              :key="row.id"
              button
              @click="openConversation(row)"
            >
              <ion-thumbnail slot="start">
                <AuthenticatedImage
                  :src="row.listingImageUrl"
                  :alt="row.listingTitle"
                  variant="thumbnail"
                />
              </ion-thumbnail>
              <ion-label>
                <h2>{{ row.listingTitle }}</h2>
                <p class="counterparty">{{ row.counterpartyLabel }}</p>
                <p class="preview">{{ row.messagePreview }}</p>
              </ion-label>
              <ConversationOverflowMenu
                slot="end"
                :listing-id="row.listingId"
                :buyer-id="row.buyerId"
                :is-archived="false"
              />
              <ion-badge v-if="row.unread" slot="end" color="primary">New</ion-badge>
            </ion-item>

            <ThreadRowSkeleton
              v-for="index in trailingSkeletonCount"
              :key="`trailing-${index}`"
            />
          </ion-list>

          <TabArchivedSection
            v-if="allItemsRevealed || activeRows.length === 0"
            v-model:expanded="showArchived"
            :has-archived="archivedRows.length > 0"
            header-label="Archived Messages"
          >
            <ion-list>
              <ion-item
                v-for="row in archivedRows"
                :key="`archived-${row.id}`"
                button
                @click="openConversation(row)"
              >
                <ion-thumbnail slot="start">
                  <AuthenticatedImage
                  :src="row.listingImageUrl"
                  :alt="row.listingTitle"
                  variant="thumbnail"
                />
                </ion-thumbnail>
                <ion-label>
                  <h2>{{ row.listingTitle }}</h2>
                  <p class="counterparty">{{ row.counterpartyLabel }}</p>
                  <p class="preview">{{ row.messagePreview }}</p>
                </ion-label>
                <ConversationOverflowMenu
                  slot="end"
                  :listing-id="row.listingId"
                  :buyer-id="row.buyerId"
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
import { onIonViewWillEnter, useIonRouter } from '@ionic/vue';
import {
  IonBadge,
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
import TabArchivedSection from '@/features/messages/components/TabArchivedSection.vue';
import ThreadRowSkeleton from '@/components/skeletons/ThreadRowSkeleton.vue';
import { useLazyReveal } from '@/common/composables/useLazyReveal';
import { useTabFeedLoader } from '@/common/composables/useTabFeedLoader';
import { debugLog } from '@/common/debug/debugLog';
import {
  getCachedInboxThreads,
  getStaleInboxThreads,
  setCachedInboxThreads,
} from '@/common/services/tabFeedCache';
import { waitForFirestoreAuth } from '@/common/services/firestoreAuth';
import { currentUser } from '@/features/auth/services/auth';
import { SESSION_EXPIRED_MESSAGE } from '@/features/auth/services/sessionExpiry';
import {
  isThreadUnread,
  partitionByArchive,
  subscribeInboxStates,
} from '@/features/messages/services/inboxState';
import { subscribeInboxThreadsRouted } from '@/features/messages/services/inboxServiceRouter';
import type { InboxState, MessageThread } from '@/types';

interface InboxRow {
  id: string;
  listingId: string;
  buyerId?: string;
  listingTitle: string;
  listingImageUrl: string;
  counterpartyLabel: string;
  messagePreview: string;
  unread: boolean;
  isSellerSide: boolean;
}

const ionRouter = useIonRouter();

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
} = useTabFeedLoader('inbox');
const threads = ref<MessageThread[]>([]);
const inboxStates = ref<Map<string, InboxState>>(new Map());
const showArchived = ref(false);
const contentRef = ref<InstanceType<typeof IonContent> | null>(null);

function threadToRow(thread: MessageThread, userId: string): InboxRow | null {
  const isSellerSide = thread.sellerId === userId && Boolean(thread.buyerId);
  const isBuyerSide = thread.sellerId !== userId;

  if (!isSellerSide && !isBuyerSide) {
    return null;
  }

  const prefix =
    thread.lastMessageSenderId === userId
      ? 'You: '
      : `${thread.lastMessageSenderName}: `;

  return {
    id: thread.id,
    listingId: thread.listingId,
    buyerId: thread.buyerId,
    listingTitle: thread.listingTitle,
    listingImageUrl: thread.listingImageUrl,
    counterpartyLabel: isSellerSide
      ? thread.buyerName ?? 'Buyer'
      : `Seller: ${thread.sellerName}`,
    messagePreview: `${prefix}${thread.lastMessageText}`,
    unread: isThreadUnread(thread, inboxStates.value, userId),
    isSellerSide,
  };
}

const inboxRows = computed(() => {
  const userId = currentUser.value?.uid;
  if (!userId) {
    return [] as InboxRow[];
  }

  const rows: InboxRow[] = [];
  for (const thread of threads.value) {
    const row = threadToRow(thread, userId);
    if (row) {
      rows.push(row);
    }
  }
  return rows;
});

const activeRows = computed(() => {
  const items = inboxRows.value.map((row) => ({
    listingId: row.listingId,
    buyerId: row.buyerId,
    row,
  }));
  return partitionByArchive(items, inboxStates.value).active.map((item) => item.row);
});

const archivedRows = computed(() => {
  const items = inboxRows.value.map((row) => ({
    listingId: row.listingId,
    buyerId: row.buyerId,
    row,
  }));
  return partitionByArchive(items, inboxStates.value).archived.map((item) => item.row);
});

const {
  visibleItems,
  trailingSkeletonCount,
  allItemsRevealed,
  onScroll,
} = useLazyReveal(activeRows, { contentRef, loading });

const showTrulyEmpty = computed(
  () => !loading.value && inboxRows.value.length === 0,
);

let unsubscribeThreads: (() => void) | undefined;
let unsubscribeInboxStates: (() => void) | undefined;

function hydratePlaceholder(uid: string): boolean {
  return hydrateFromCache(
    () => getStaleInboxThreads(uid) ?? getCachedInboxThreads(uid),
    (cached) => {
      threads.value = cached;
    },
    uid,
  );
}

async function loadInbox() {
  const generation = beginLoad();

  const hadPlaceholder = currentUser.value?.uid
    ? hydratePlaceholder(currentUser.value.uid)
    : false;

  if (!hadPlaceholder) {
    startLoadingSpinner();
  }

  debugLog.debug('inbox', 'Load start', {
    generation,
    hadPlaceholder,
    placeholderCount: threads.value.length,
  });

  try {
    const user = currentUser.value;
    if (!user) {
      failLoad(generation, 'You must be signed in to view your inbox.');
      return;
    }

    unsubscribeThreads?.();
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
        debugLog.debug('inbox', 'Threads loaded', {
          generation,
          uid: user.uid,
          count: nextThreads.length,
          inboxRowCount: inboxRows.value.length,
        });
      },
      (loadError) => {
        const message = loadError.message.includes('session')
          ? SESSION_EXPIRED_MESSAGE
          : 'Could not load your messages.';
        if (inboxRows.value.length === 0) {
          failLoad(generation, message, loadError);
        } else {
          finishLoad(generation, 'partial-after-error');
        }
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
    const message = err instanceof Error ? err.message : 'Could not load your messages.';
    failLoad(generation, message, err);
  }
}

function retryLoad() {
  void loadInbox();
}

function openConversation(row: InboxRow) {
  const buyerQuery = row.buyerId
    ? `?buyerId=${encodeURIComponent(row.buyerId)}`
    : '';
  ionRouter.push(`/tabs/inbox/listing/${row.listingId}${buyerQuery}`);
}

onIonViewWillEnter(() => {
  void loadInbox();
});

const setupUid = currentUser.value?.uid;
if (setupUid) {
  hydratePlaceholder(setupUid);
}

onUnmounted(() => {
  cancelLoad();
  unsubscribeThreads?.();
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

.counterparty {
  color: var(--ion-color-primary);
  font-weight: 600;
}

.preview {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}
</style>
