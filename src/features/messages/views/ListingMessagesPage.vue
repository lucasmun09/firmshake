<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-button
            v-if="isSeller && selectedBuyerId && !fromInbox"
            fill="clear"
            @click="clearBuyerConversation"
          >
            <ion-icon slot="icon-only" :icon="chevronBackOutline" />
          </ion-button>
          <ion-back-button v-else :default-href="messagesBackHref" />
        </ion-buttons>
        <ion-title>{{ pageTitle }}</ion-title>
        <ion-buttons v-if="canArchiveConversation" slot="end">
          <ion-button fill="clear" @click="toggleArchive">
            {{ conversationArchived ? 'Unarchive' : 'Archive' }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content v-if="listingLoading" class="ion-padding">
      <AppContentFrame>
        <ListingDetailSkeleton />
      </AppContentFrame>
    </ion-content>

    <ion-content v-else-if="listing" ref="contentRef" class="chat-content" @ionScroll="onScroll">
      <AppContentFrame>
      <div class="listing-summary">
        <AuthenticatedImage :src="listing.imageUrl" :alt="listing.title" />
        <div>
          <div class="title-row">
            <h2>{{ listing.title }}</h2>
            <span v-if="listing.status === 'removed'" class="delisted-label">Item Delisted</span>
          </div>
          <p>{{ formatPrice(listing.price) }} · Seller: {{ listing.sellerName }}</p>
          <ListingThreadActions
            :listing-id="listing.id"
            :role="isSeller ? 'seller' : 'buyer'"
            :firm-shake-kind="firmShakeState.kind"
            :listing-delisted="listing.status === 'removed'"
            :interactions-disabled="messagingDisabled"
          />
        </div>
      </div>

      <FirmShakeInlinePanel
        v-if="inlineAgreement"
        :agreement="inlineAgreement"
        :role="isSeller ? 'seller' : 'buyer'"
        :show-buyer-name="isSeller"
        :interactions-disabled="messagingDisabled"
      />

      <div ref="chatAnchorRef">
      <ListingChatSection
        :is-seller="isSeller"
        :current-user-id="currentUser?.uid"
        :messages-error="messagesError"
        :conversations="conversations"
        :selected-buyer-id="selectedBuyerId"
        :selected-buyer-name="selectedBuyerName"
        :display-messages="visibleMessages"
        :participant-profiles="participantProfiles"
        :conversation-partner-id="conversationPartnerId"
        :blocked-by-me="blockedByMe"
        :blocked-by-other="blockedByOther"
        :show-block-action="showBlockAction"
        :buyer-firm-shake-labels="buyerFirmShakeLabels"
        :messages-loading="messagesLoading"
        :message-skeleton-count="skeletonCount"
        :archive-listing-id="listing.id"
        buyer-hint="Chat with the seller about this listing."
        seller-hint="Select a buyer to view and reply to their messages."
        @select-conversation="selectBuyerConversation"
        @back-to-list="clearBuyerConversation"
        @toggle-block="handleToggleBlock"
      />
      </div>
      </AppContentFrame>
    </ion-content>

    <ion-content v-else>
      <AppContentFrame>
      <div class="empty-state">
        <p>Listing not found.</p>
      </div>
      </AppContentFrame>
    </ion-content>

    <ion-footer v-if="listing && showComposer">
      <ion-toolbar class="app-toolbar-content">
        <AppContentFrame>
        <ion-item lines="none" class="composer">
          <ion-input
            v-model="messageText"
            :placeholder="composerPlaceholder"
            :disabled="messagingDisabled"
            @keyup.enter="handleSendMessage"
          />
          <ion-button
            slot="end"
            :disabled="sending || messagingDisabled || !messageText.trim()"
            @click="handleSendMessage"
          >
            Send
          </ion-button>
        </ion-item>
        </AppContentFrame>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { formatPrice } from '@/utils/currency';
import { computed, onUnmounted, ref, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { onIonViewWillEnter } from '@ionic/vue';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonPage,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue';
import { chevronBackOutline } from 'ionicons/icons';

import FirmShakeInlinePanel from '@/features/meetups/components/FirmShakeInlinePanel.vue';
import ListingChatSection from '@/features/messages/components/ListingChatSection.vue';
import ListingThreadActions from '@/features/messages/components/ListingThreadActions.vue';
import AppContentFrame from '@/components/AppContentFrame.vue';
import AuthenticatedImage from '@/components/AuthenticatedImage.vue';
import ListingDetailSkeleton from '@/components/skeletons/ListingDetailSkeleton.vue';
import { useLazyReveal } from '@/common/composables/useLazyReveal';
import { useListingChat } from '@/features/messages/composables/useListingChat';
import { useListingMessages } from '@/features/messages/composables/useListingMessages';
import { useParticipantProfiles } from '@/common/composables/useParticipantProfiles';
import { authReady, currentUser } from '@/features/auth/services/auth';
import {
  confirmBlockUser,
  resolveBlockedDisplayName,
  showBlockSuccessToast,
} from '@/common/services/blockUi';
import { blockUser, subscribeUserBlocked, unblockUser } from '@/common/services/blocks';
import {
  cancelActiveAgreementOnBlock,
  findAgreementForBuyer,
  getBuyerListingFirmShakeState,
  getAgreementStatusLabel,
  getSellerListingFirmShakeState,
  isActiveAgreement,
  subscribeBuyerAgreements,
  subscribeSellerAgreements,
} from '@/common/services/agreements';
import { getListingById } from '@/features/listings/services/listings';
import { markListingNotificationsRead, markListingThreadRead } from '@/features/messages/services/notifications';
import {
  isConversationArchived,
  subscribeInboxStates,
} from '@/features/messages/services/inboxState';
import {
  routeArchiveConversation,
  routeUnarchiveConversation,
} from '@/features/messages/services/inboxServiceRouter';
import { syncMessageThreadForUser } from '@/features/messages/services/threads';
import {
  filterMessagesForParticipant,
  getConversationMessages,
  groupMessagesByBuyer,
} from '@/features/listings/utils/listingConversations';
import type { Agreement, InboxState, Listing, Message } from '@/types';

const route = useRoute();
const router = useRouter();

const listing = ref<Listing | null>(null);
const listingLoading = ref(true);
const selectedBuyerId = ref<string | null>(null);
const blockedByMe = ref(false);
const blockedByOther = ref(false);
const listingAgreements = ref<Agreement[]>([]);
const inboxStates = ref<Map<string, InboxState>>(new Map());
const chatAnchorRef = ref<HTMLElement | null>(null);
const contentRef = ref<InstanceType<typeof IonContent> | null>(null);

const userId = computed(() => currentUser.value?.uid);

const {
  messages: allMessages,
  error: messagesError,
  ready: messagesReady,
  start: startMessagesSubscription,
  stop: stopMessagesSubscription,
} = useListingMessages(listing, userId);

const messagesLoading = computed(
  () => Boolean(listing.value) && !messagesReady.value && !messagesError.value,
);

const {
  messageText,
  sending,
  sendMessage,
} = useListingChat(allMessages);

const isSeller = computed(
  () =>
    Boolean(
      listing.value &&
        currentUser.value &&
        listing.value.sellerId === currentUser.value.uid,
    ),
);

const conversations = computed(() => {
  if (!listing.value || !isSeller.value) {
    return [];
  }

  const fromMessages = groupMessagesByBuyer(allMessages.value, listing.value.sellerId);
  const byBuyerId = new Map(fromMessages.map((conversation) => [conversation.buyerId, conversation]));

  for (const agreement of listingAgreements.value) {
    if (!isActiveAgreement(agreement)) {
      continue;
    }

    if (byBuyerId.has(agreement.buyerId)) {
      continue;
    }

    byBuyerId.set(agreement.buyerId, {
      buyerId: agreement.buyerId,
      buyerName: agreement.buyerName,
      messages: [],
      lastMessage: undefined,
      lastMessageAt: agreement.meetupAt,
    });
  }

  return [...byBuyerId.values()]
    .filter(
      (conversation) =>
        !isConversationArchived(
          inboxStates.value,
          listing.value!.id,
          conversation.buyerId,
        ),
    )
    .sort((left, right) => {
    const leftTime = left.lastMessageAt?.getTime() ?? 0;
    const rightTime = right.lastMessageAt?.getTime() ?? 0;
    return rightTime - leftTime;
  });
});

const selectedBuyerName = computed(() => {
  if (!selectedBuyerId.value) {
    return '';
  }

  return (
    conversations.value.find(
      (conversation) => conversation.buyerId === selectedBuyerId.value,
    )?.buyerName ?? 'Buyer'
  );
});

const conversationPartnerId = computed(() => {
  if (!listing.value || !currentUser.value) {
    return null;
  }

  if (isSeller.value) {
    return selectedBuyerId.value;
  }

  return listing.value.sellerId;
});

const chatParticipantIds = computed(() => {
  const ids = new Set<string>();
  if (currentUser.value?.uid) {
    ids.add(currentUser.value.uid);
  }
  if (conversationPartnerId.value) {
    ids.add(conversationPartnerId.value);
  }
  if (listing.value?.sellerId) {
    ids.add(listing.value.sellerId);
  }
  return [...ids];
});

const { participantProfiles } = useParticipantProfiles(chatParticipantIds);

const showBlockAction = computed(() => {
  if (!conversationPartnerId.value) {
    return false;
  }

  return isSeller.value ? Boolean(selectedBuyerId.value) : true;
});

const displayMessages = computed(() => {
  if (!listing.value || !currentUser.value) {
    return [];
  }

  if (isSeller.value) {
    if (!selectedBuyerId.value) {
      return [];
    }

    return getConversationMessages(
      allMessages.value,
      listing.value.sellerId,
      selectedBuyerId.value,
    );
  }

  return filterMessagesForParticipant(
    allMessages.value,
    listing.value.sellerId,
    currentUser.value.uid,
  );
});

const {
  visibleItems: visibleMessages,
  skeletonCount,
  onScroll,
} = useLazyReveal(displayMessages, {
  contentRef,
  loading: messagesLoading,
  estimatedItemHeight: 64,
});

const showComposer = computed(() => {
  if (messagesError.value || blockedByOther.value) {
    return false;
  }

  if (isSeller.value) {
    return Boolean(selectedBuyerId.value);
  }

  return true;
});

const messagingDisabled = computed(() => blockedByMe.value || blockedByOther.value);

const composerPlaceholder = computed(() => {
  if (blockedByMe.value) {
    return 'Unblock this user to send messages';
  }

  return 'Write a message...';
});

const pageTitle = computed(() => {
  if (isSeller.value && selectedBuyerId.value) {
    return selectedBuyerName.value;
  }

  return listing.value?.title ?? 'Messages';
});

const messagesBackHref = computed(() => {
  const back = route.meta.messagesBack;
  return typeof back === 'string' ? back : '/tabs/inbox';
});

const fromInbox = computed(() => route.name === 'InboxListingMessages');

const canArchiveConversation = computed(() => {
  if (!listing.value || !currentUser.value) {
    return false;
  }

  if (isSeller.value) {
    return Boolean(selectedBuyerId.value);
  }

  return true;
});

const conversationArchived = computed(() => {
  if (!listing.value) {
    return false;
  }

  return isConversationArchived(
    inboxStates.value,
    listing.value.id,
    isSeller.value ? selectedBuyerId.value ?? undefined : undefined,
  );
});

const inlineAgreement = computed(() => {
  if (listingAgreements.value.length === 0) {
    return null;
  }

  if (isSeller.value) {
    if (!selectedBuyerId.value) {
      return null;
    }

    const agreement = findAgreementForBuyer(
      listingAgreements.value,
      selectedBuyerId.value,
    );
    return agreement && isActiveAgreement(agreement) ? agreement : null;
  }

  const agreement = findAgreementForBuyer(
    listingAgreements.value,
    currentUser.value?.uid ?? '',
  );
  return agreement && isActiveAgreement(agreement) ? agreement : null;
});

const firmShakeState = computed(() => {
  if (isSeller.value) {
    return getSellerListingFirmShakeState(listingAgreements.value);
  }

  return getBuyerListingFirmShakeState(listingAgreements.value);
});

const buyerFirmShakeLabels = computed(() => {
  const labels: Record<string, string> = {};

  for (const agreement of listingAgreements.value) {
    if (!isActiveAgreement(agreement) && agreement.status !== 'proposed') {
      continue;
    }

    if (agreement.status === 'proposed') {
      labels[agreement.buyerId] = `FirmShake received · ${formatPrice(agreement.price)}`;
    } else {
      labels[agreement.buyerId] = getAgreementStatusLabel(agreement.status);
    }
  }

  return labels;
});

let unsubscribeAgreements: (() => void) | undefined;
let unsubscribeInboxStates: (() => void) | undefined;
let unsubscribeBlockedByMe: (() => void) | undefined;
let unsubscribeBlockedByOther: (() => void) | undefined;
let blockeeCancelInFlight: string | null = null;

function readBuyerIdFromRoute(): string | null {
  const buyerId = route.query.buyerId;
  return typeof buyerId === 'string' && buyerId.length > 0 ? buyerId : null;
}

function stopBlockSubscriptions() {
  unsubscribeBlockedByMe?.();
  unsubscribeBlockedByMe = undefined;
  unsubscribeBlockedByOther?.();
  unsubscribeBlockedByOther = undefined;
}

function startBlockSubscriptions() {
  stopBlockSubscriptions();

  const user = currentUser.value;
  const partnerId = conversationPartnerId.value;
  if (!user || !partnerId) {
    blockedByMe.value = false;
    blockedByOther.value = false;
    return;
  }

  unsubscribeBlockedByMe = subscribeUserBlocked(user.uid, partnerId, (blocked) => {
    blockedByMe.value = blocked;
  });

  unsubscribeBlockedByOther = subscribeUserBlocked(partnerId, user.uid, (blocked) => {
    blockedByOther.value = blocked;
  });
}

async function scrollMessagesIntoView() {
  await nextTick();
  chatAnchorRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function selectBuyerConversation(buyerId: string) {
  selectedBuyerId.value = buyerId;
  void router.replace({
    name: route.name ?? 'SellingListingMessages',
    params: { id: route.params.id as string },
    query: { buyerId },
  });
  void scrollMessagesIntoView();
}

function clearBuyerConversation() {
  selectedBuyerId.value = null;
  messageText.value = '';
  stopBlockSubscriptions();
  void router.replace({
    name: route.name ?? 'SellingListingMessages',
    params: { id: route.params.id as string },
  });
}

async function cancelAgreementIfBlockedByOther() {
  if (!blockedByOther.value) {
    return;
  }

  const user = currentUser.value;
  const agreement = inlineAgreement.value;
  if (!user || !agreement || !isActiveAgreement(agreement)) {
    return;
  }

  if (blockeeCancelInFlight === agreement.id) {
    return;
  }

  blockeeCancelInFlight = agreement.id;
  try {
    await cancelActiveAgreementOnBlock(agreement, user.uid);
  } catch (error) {
    console.warn('Could not cancel FirmShake after block', error);
  } finally {
    blockeeCancelInFlight = null;
  }
}

watch(
  () => displayMessages.value.length,
  () => {
    void scrollMessagesIntoView();
  },
);

watch(conversationPartnerId, () => {
  startBlockSubscriptions();
});

watch(blockedByOther, (blocked) => {
  if (blocked) {
    void cancelAgreementIfBlockedByOther();
  }
});

watch(inlineAgreement, () => {
  if (blockedByOther.value) {
    void cancelAgreementIfBlockedByOther();
  }
});

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

async function loadThread() {
  const listingId = route.params.id as string;
  const user = currentUser.value;
  listingLoading.value = true;
  stopMessagesSubscription();

  try {
    await waitForAuthReady();
    listing.value = await getListingById(listingId, { preferCache: true });

    unsubscribeAgreements?.();
    unsubscribeInboxStates?.();

    if (user) {
      unsubscribeInboxStates = subscribeInboxStates(user.uid, (states) => {
        inboxStates.value = states;
      });
    }

    if (listing.value && user) {
      selectedBuyerId.value = isSeller.value ? readBuyerIdFromRoute() : null;
      listingAgreements.value = [];

      if (isSeller.value) {
        unsubscribeAgreements = subscribeSellerAgreements(user.uid, (agreements) => {
          listingAgreements.value = agreements.filter(
            (agreement) => agreement.listingId === listingId,
          );
        });
      } else {
        unsubscribeAgreements = subscribeBuyerAgreements(user.uid, (agreements) => {
          listingAgreements.value = agreements.filter(
            (agreement) => agreement.listingId === listingId,
          );
        });
      }

      startMessagesSubscription();
      startBlockSubscriptions();
    }
  } finally {
    listingLoading.value = false;
    await scrollMessagesIntoView();
  }
}

watch(
  () => allMessages.value.length,
  async (length, previousLength) => {
    if (length === 0 || length === previousLength) {
      return;
    }

    const user = currentUser.value;
    if (!user || !listing.value || messagesError.value) {
      return;
    }

    const lastMessage = allMessages.value[allMessages.value.length - 1];
    void syncMessageThreadForUser(user.uid, listing.value, lastMessage).catch((error) => {
      console.warn('Could not backfill message thread', error);
    });

    await Promise.all([
      markListingThreadRead(
        user.uid,
        listing.value.id,
        isSeller.value ? selectedBuyerId.value ?? undefined : undefined,
      ),
      markListingNotificationsRead(user.uid, listing.value.id),
    ]);
  },
);

onIonViewWillEnter(() => {
  void loadThread();
});

onUnmounted(() => {
  stopMessagesSubscription();
  unsubscribeAgreements?.();
  unsubscribeInboxStates?.();
  stopBlockSubscriptions();
});

async function toggleArchive() {
  const user = currentUser.value;
  if (!user || !listing.value) {
    return;
  }

  const buyerId = isSeller.value ? selectedBuyerId.value ?? undefined : undefined;

  try {
    if (conversationArchived.value) {
      await routeUnarchiveConversation(user.uid, listing.value.id, buyerId);
    } else {
      await routeArchiveConversation(user.uid, listing.value.id, buyerId);
    }
  } catch {
    const toast = await toastController.create({
      message: conversationArchived.value
        ? 'Could not unarchive this conversation.'
        : 'Could not archive this conversation.',
      duration: 2500,
      color: 'danger',
    });
    await toast.present();
  }
}

async function handleToggleBlock() {
  const user = currentUser.value;
  const partnerId = conversationPartnerId.value;
  if (!user || !partnerId) {
    return;
  }

  if (blockedByMe.value) {
    try {
      await unblockUser(user.uid, partnerId);
    } catch {
      const toast = await toastController.create({
        message: 'Could not update block settings',
        duration: 2500,
        color: 'danger',
      });
      await toast.present();
    }
    return;
  }

  const confirmed = await confirmBlockUser();
  if (!confirmed) {
    return;
  }

  const displayName = resolveBlockedDisplayName(
    partnerId,
    participantProfiles.value,
    isSeller.value ? selectedBuyerName.value : listing.value?.sellerName ?? 'FirmShake User',
  );

  try {
    await blockUser(user.uid, partnerId);
    await showBlockSuccessToast(displayName);
  } catch {
    const toast = await toastController.create({
      message: 'Could not update block settings',
      duration: 2500,
      color: 'danger',
    });
    await toast.present();
  }
}

async function handleSendMessage() {
  if (!listing.value || messagingDisabled.value) {
    return;
  }

  if (isSeller.value && !selectedBuyerId.value) {
    return;
  }

  try {
    await sendMessage(listing.value.id, {
      recipientId: isSeller.value ? selectedBuyerId.value ?? undefined : undefined,
    });
    await scrollMessagesIntoView();
  } catch (error) {
    const toast = await toastController.create({
      message:
        error instanceof Error ? error.message : 'Could not send your message. Please try again.',
      duration: 2500,
      color: 'danger',
    });
    await toast.present();
  }
}
</script>

<style scoped>
.listing-summary {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  border-bottom: 1px solid var(--ion-color-step-150);
}

.listing-summary img {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 8px;
}

.listing-summary h2 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
}

.title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.25rem;
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

.listing-summary p {
  margin: 0;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.chat-content {
  --padding-bottom: 80px;
}

.empty-state {
  color: var(--ion-color-medium);
  text-align: center;
  padding: 2rem 1rem;
}

.composer {
  --background: transparent;
  width: 100%;
}

.firmshake-label {
  color: var(--ion-color-primary);
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0.25rem 0 0;
}
</style>
