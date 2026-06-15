<template>
  <ion-page class="listing-page">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/home" />
        </ion-buttons>
        <ion-title>{{ listing?.title ?? 'Listing' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content v-if="loading || !listing" class="listing-content">
      <AppContentFrame>
        <div v-if="loading" class="empty-state">
          <ion-spinner name="crescent" />
          <p>Loading listing...</p>
        </div>
        <div v-else class="empty-state">
          <p>Listing not found.</p>
        </div>
      </AppContentFrame>
    </ion-content>

    <ion-content
      v-else
      ref="contentRef"
      class="listing-content"
    >
      <AppContentFrame>
      <div class="hero-wrap">
        <AuthenticatedImage
          class="hero-image"
          :src="listing.imageUrl"
          :alt="listing.title"
        />
      </div>

      <div ref="stickyBlockRef" class="listing-sticky">
        <div class="details">
          <h1>{{ listing.title }}</h1>
          <p class="price">{{ formatPrice(listing.price) }}</p>
          <p class="seller">Seller: {{ listing.sellerName }}</p>
          <p class="description">{{ listing.description }}</p>

          <ion-chip v-for="name in communityNames" :key="name" color="primary" outline>
            {{ name }}
          </ion-chip>
        </div>

        <ListingMeetupSection
          :is-seller="isSeller"
          :listing-id="listing.id"
          :buyer-agreement="buyerAgreement"
          :seller-agreements="sellerAgreements"
          :busy="meetupBusy"
          @accept="handleAcceptProposal"
          @decline="handleDeclineProposal"
          @pay-deposit="handlePayDeposit"
          @start-meetup="handleStartMeetup"
        />

        <ListingChatSection
          variant="header"
          :is-seller="isSeller"
          :current-user-id="currentUser?.uid"
          :messages-error="messagesError"
          :conversations="conversations"
          :selected-buyer-id="selectedBuyerId"
          :selected-buyer-name="selectedBuyerName"
          :display-messages="displayMessages"
          :conversation-partner-id="conversationPartnerId"
          :blocked-by-me="blockedByMe"
          :blocked-by-other="blockedByOther"
          :show-block-action="showBlockAction"
          :inbox-link="`/inbox/listing/${listing.id}`"
          buyer-hint="Chat with the seller about this listing."
          seller-hint="Select a buyer to view and reply to their messages."
          @select-conversation="selectBuyerConversation"
          @back-to-list="clearBuyerConversation"
          @toggle-block="handleToggleBlock"
        />
      </div>

      <div
        v-if="useNestedChatScroll"
        ref="chatScrollPanelRef"
        class="chat-scroll-panel"
        :style="chatPanelStyle"
        @wheel="handleChatWheel"
      >
        <ListingChatSection
          variant="body"
          :is-seller="isSeller"
          :current-user-id="currentUser?.uid"
          :messages-error="messagesError"
          :conversations="conversations"
          :selected-buyer-id="selectedBuyerId"
          :selected-buyer-name="selectedBuyerName"
          :display-messages="displayMessages"
          @select-conversation="selectBuyerConversation"
          @back-to-list="clearBuyerConversation"
        />
      </div>

      <div v-else class="messages-body-anchor">
        <ListingChatSection
          variant="body"
          :is-seller="isSeller"
          :current-user-id="currentUser?.uid"
          :messages-error="messagesError"
          :conversations="conversations"
          :selected-buyer-id="selectedBuyerId"
          :selected-buyer-name="selectedBuyerName"
          :display-messages="displayMessages"
          @select-conversation="selectBuyerConversation"
          @back-to-list="clearBuyerConversation"
        />
      </div>

      <div class="scroll-end-spacer" />
      </AppContentFrame>
    </ion-content>

    <ion-footer v-if="listing && !loading && showComposer">
      <ion-toolbar class="app-toolbar-content">
        <AppContentFrame>
        <ion-item lines="none" class="composer">
          <ion-input
            v-model="messageText"
            placeholder="Write a message..."
            @keyup.enter="handleSendMessage"
          />
          <ion-button slot="end" :disabled="sending || !messageText.trim()" @click="handleSendMessage">
            Send
          </ion-button>
        </ion-item>
        </AppContentFrame>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { onIonViewWillEnter } from '@ionic/vue';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFooter,
  IonHeader,
  IonInput,
  IonItem,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue';

import ListingMeetupSection from '@/components/ListingMeetupSection.vue';
import ListingChatSection from '@/components/ListingChatSection.vue';
import AppContentFrame from '@/components/AppContentFrame.vue';
import AuthenticatedImage from '@/components/AuthenticatedImage.vue';
import { useListingChat } from '@/composables/useListingChat';
import { useListingNestedChatScroll } from '@/composables/useListingNestedChatScroll';
import {
  acceptMeetupProposal,
  confirmMeetupDeposit,
  declineMeetupProposal,
  findBuyerAgreementForListing,
  startMeetupEnRoute,
  subscribeAgreement,
  subscribeListingAgreements,
} from '@/services/agreements';
import { authReady, currentUser } from '@/services/auth';
import { fetchCommunities, getCommunityName } from '@/services/communities';
import { getListingById } from '@/services/listings';
import {
  fetchListingMessages,
  getMessageAccessOptions,
  subscribeListingMessages,
} from '@/services/messages';
import { blockUser, subscribeUserBlocked, unblockUser } from '@/services/blocks';
import { syncMessageThreadForUser } from '@/services/threads';
import {
  filterMessagesForParticipant,
  getConversationMessages,
  groupMessagesByBuyer,
} from '@/utils/listingConversations';
import type { Agreement, Community, Listing, Message } from '@/types';

const route = useRoute();
const router = useRouter();
const listing = ref<Listing | null>(null);
const communities = ref<Community[]>([]);
const loading = ref(true);
const communityNames = ref<string[]>([]);
const meetupBusy = ref(false);
const buyerAgreement = ref<Agreement | null>(null);
const sellerAgreements = ref<Agreement[]>([]);
const messagesError = ref('');
const allMessages = ref<Message[]>([]);
const selectedBuyerId = ref<string | null>(null);
const blockedByMe = ref(false);
const blockedByOther = ref(false);
const contentRef = ref<InstanceType<typeof IonContent> | null>(null);
const stickyBlockRef = ref<HTMLElement | null>(null);
const chatScrollPanelRef = ref<HTMLElement | null>(null);

const {
  chatPanelMaxHeight,
  setupPanelHeightObserver,
  scrollToLatest,
  scrollChatIfAtBottom,
  scrollChatToBottom,
} = useListingNestedChatScroll(contentRef, chatScrollPanelRef, stickyBlockRef);

async function handleChatWheel(event: WheelEvent) {
  const panel = chatScrollPanelRef.value;
  if (!panel || event.deltaY >= 0 || panel.scrollTop > 0) {
    return;
  }

  const scrollEl = await (contentRef.value?.$el as HTMLIonContentElement | undefined)?.getScrollElement();
  if (!scrollEl || scrollEl.scrollTop <= 0) {
    return;
  }

  scrollEl.scrollTop = Math.max(0, scrollEl.scrollTop + event.deltaY);
  event.preventDefault();
}

const chatPanelStyle = computed(() => {
  if (!chatPanelMaxHeight.value) {
    return undefined;
  }

  return {
    maxHeight: `${chatPanelMaxHeight.value}px`,
  };
});

const {
  messageText,
  sending,
  sendMessage,
} = useListingChat(allMessages);

const conversations = computed(() => {
  if (!listing.value || !isSeller.value) {
    return [];
  }

  return groupMessagesByBuyer(allMessages.value, listing.value.sellerId);
});

const selectedBuyerName = computed(() => {
  if (!selectedBuyerId.value) {
    return '';
  }

  return (
    conversations.value.find((conversation) => conversation.buyerId === selectedBuyerId.value)
      ?.buyerName ?? 'Buyer'
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

const showComposer = computed(() => {
  if (messagesError.value || blockedByMe.value || blockedByOther.value) {
    return false;
  }

  if (isSeller.value) {
    return Boolean(selectedBuyerId.value);
  }

  return true;
});

const useNestedChatScroll = computed(() => {
  if (messagesError.value) {
    return false;
  }

  if (isSeller.value) {
    return Boolean(selectedBuyerId.value);
  }

  return true;
});

const isSeller = computed(
  () =>
    Boolean(
      listing.value &&
        currentUser.value &&
        listing.value.sellerId === currentUser.value.uid,
    ),
);

let unsubscribeMessages: (() => void) | undefined;
let unsubscribeBlockedByMe: (() => void) | undefined;
let unsubscribeBlockedByOther: (() => void) | undefined;
let unsubscribeBuyerAgreement: (() => void) | undefined;
let unsubscribeSellerAgreements: (() => void) | undefined;
let loadingListingFor: string | null = null;

function stopAgreementSubscriptions() {
  unsubscribeBuyerAgreement?.();
  unsubscribeBuyerAgreement = undefined;
  unsubscribeSellerAgreements?.();
  unsubscribeSellerAgreements = undefined;
}

function startAgreementSubscriptions(listingId: string, loadedListing: Listing) {
  stopAgreementSubscriptions();

  const user = currentUser.value;
  if (!user) {
    return;
  }

  if (loadedListing.sellerId === user.uid) {
    unsubscribeSellerAgreements = subscribeListingAgreements(
      listingId,
      user.uid,
      (agreements) => {
        sellerAgreements.value = agreements;
      },
    );
    buyerAgreement.value = null;
    return;
  }

  void findBuyerAgreementForListing(listingId, user.uid).then((agreement) => {
    buyerAgreement.value = agreement;
    if (agreement) {
      unsubscribeBuyerAgreement = subscribeAgreement(agreement.id, (nextAgreement) => {
        buyerAgreement.value = nextAgreement;
      });
    }
  });
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

function stopMessageSubscription() {
  unsubscribeMessages?.();
  unsubscribeMessages = undefined;
}

function startMessages(loadedListing: Listing) {
  unsubscribeMessages?.();

  const user = currentUser.value;
  const access = user ? getMessageAccessOptions(loadedListing, user.uid) : undefined;

  unsubscribeMessages = subscribeListingMessages(
    loadedListing.id,
    (nextMessages) => {
      messagesError.value = '';
      allMessages.value = nextMessages;
      void scrollChatIfAtBottom();
    },
    (error) => {
      messagesError.value = 'Unable to fetch messages';
      console.error(error);
    },
    access,
  );
}

function selectBuyerConversation(buyerId: string) {
  selectedBuyerId.value = buyerId;
  startBlockSubscriptions();
  void nextTick(() => {
    setupPanelHeightObserver();
    void scrollToLatest();
  });
}

function clearBuyerConversation() {
  selectedBuyerId.value = null;
  messageText.value = '';
}

async function loadMessagesForListing(loadedListing: Listing) {
  messagesError.value = '';
  allMessages.value = [];
  selectedBuyerId.value = null;
  stopMessageSubscription();
  stopBlockSubscriptions();

  const user = currentUser.value;
  if (!user) {
    messagesError.value = 'Unable to fetch messages';
    return;
  }

  try {
    const access = getMessageAccessOptions(loadedListing, user.uid);
    allMessages.value = await fetchListingMessages(loadedListing.id, access);
    startMessages(loadedListing);
    startBlockSubscriptions();
  } catch (error) {
    messagesError.value = 'Unable to fetch messages';
    console.error('Failed to load listing messages', error);
  }
}

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

async function loadListing() {
  const listingId = route.params.id as string;
  if (loadingListingFor === listingId) {
    return;
  }

  loadingListingFor = listingId;
  loading.value = true;
  messagesError.value = '';
  chatPanelMaxHeight.value = null;
  stopMessageSubscription();
  stopAgreementSubscriptions();
  allMessages.value = [];
  selectedBuyerId.value = null;
  buyerAgreement.value = null;
  sellerAgreements.value = [];

  try {
    await waitForAuthReady();

    const [loadedListing, loadedCommunities] = await Promise.all([
      getListingById(listingId),
      fetchCommunities(),
    ]);

    listing.value = loadedListing;
    communities.value = loadedCommunities;

    if (loadedListing) {
      communityNames.value = loadedListing.communityIds
        .map((id) => getCommunityName(loadedCommunities, id))
        .filter((name): name is string => Boolean(name));

      startAgreementSubscriptions(listingId, loadedListing);
      await loadMessagesForListing(loadedListing);

      const user = currentUser.value;
      const lastMessage = allMessages.value[allMessages.value.length - 1];
      if (user && lastMessage && !messagesError.value) {
        void syncMessageThreadForUser(user.uid, loadedListing, lastMessage).catch((error) => {
          console.warn('Could not backfill message thread', error);
        });
      }
    }
  } catch (error) {
    console.error('Failed to load listing', error);
  } finally {
    loading.value = false;
    loadingListingFor = null;
    await nextTick();
    setupPanelHeightObserver();
    if (useNestedChatScroll.value) {
      await scrollToLatest();
    }
  }
}

watch(
  () => route.params.id,
  (nextId, previousId) => {
    if (nextId && nextId !== previousId) {
      void loadListing();
    }
  },
);

watch(
  () => displayMessages.value.length,
  (nextLength, previousLength) => {
    if (nextLength > previousLength) {
      void scrollChatIfAtBottom();
    }
  },
);

watch(useNestedChatScroll, (enabled) => {
  if (enabled) {
    void nextTick(() => {
      setupPanelHeightObserver();
      void scrollToLatest();
    });
  }
});

onIonViewWillEnter(() => {
  void loadListing().catch((error) => {
    console.error('Failed to load listing page', error);
  });
});

onUnmounted(() => {
  stopMessageSubscription();
  stopBlockSubscriptions();
  stopAgreementSubscriptions();
});

async function handleToggleBlock() {
  const user = currentUser.value;
  const partnerId = conversationPartnerId.value;
  if (!user || !partnerId) {
    return;
  }

  try {
    if (blockedByMe.value) {
      await unblockUser(user.uid, partnerId);
    } else {
      await blockUser(user.uid, partnerId);
    }
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
  if (!listing.value) {
    return;
  }

  if (isSeller.value && !selectedBuyerId.value) {
    return;
  }

  try {
    await sendMessage(listing.value.id, {
      recipientId: isSeller.value ? selectedBuyerId.value ?? undefined : undefined,
    });
    await scrollChatToBottom();
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

function formatPrice(price: number): string {
  return price === 0 ? 'Free' : `$${price}`;
}

async function handleAcceptProposal(agreementId: string) {
  const user = currentUser.value;
  if (!user) {
    return;
  }

  meetupBusy.value = true;
  try {
    await acceptMeetupProposal(agreementId, user.uid);
  } catch (error) {
    const toast = await toastController.create({
      message: error instanceof Error ? error.message : 'Could not accept meetup request',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    meetupBusy.value = false;
  }
}

async function handleDeclineProposal(agreementId: string) {
  const user = currentUser.value;
  if (!user) {
    return;
  }

  meetupBusy.value = true;
  try {
    await declineMeetupProposal(agreementId, user.uid);
  } catch (error) {
    const toast = await toastController.create({
      message: error instanceof Error ? error.message : 'Could not decline meetup request',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    meetupBusy.value = false;
  }
}

async function handlePayDeposit(agreementId: string) {
  const user = currentUser.value;
  if (!user) {
    return;
  }

  meetupBusy.value = true;
  try {
    await confirmMeetupDeposit(agreementId, user.uid);
    const toast = await toastController.create({
      message: 'Deposit confirmed. Stripe payments arrive in the next milestone.',
      duration: 3000,
      color: 'success',
    });
    await toast.present();
  } catch (error) {
    const toast = await toastController.create({
      message: error instanceof Error ? error.message : 'Could not confirm deposit',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    meetupBusy.value = false;
  }
}

async function handleStartMeetup(agreementId: string) {
  meetupBusy.value = true;
  try {
    await startMeetupEnRoute(agreementId);
    await router.push(`/meetup/${agreementId}`);
  } catch (error) {
    const toast = await toastController.create({
      message: error instanceof Error ? error.message : 'Could not start meetup',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    meetupBusy.value = false;
  }
}
</script>

<style scoped>
.listing-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.listing-content {
  --background: var(--ion-background-color);
}

.hero-wrap {
  height: min(320px, 42vh);
  overflow: hidden;
}

.hero-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.listing-sticky {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--ion-background-color);
  border-bottom: 1px solid var(--ion-color-step-150);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.details {
  padding: 1rem;
}

.details h1 {
  margin: 0 0 0.25rem;
}

.price {
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--ion-color-primary);
  margin: 0.25rem 0;
}

.seller {
  color: var(--ion-color-medium);
  margin: 0;
}

.description {
  margin: 1rem 0;
  line-height: 1.5;
}

.messages-body-anchor {
  min-height: 1px;
}

.chat-scroll-panel {
  overflow-y: auto;
  overscroll-behavior-y: auto;
  -webkit-overflow-scrolling: touch;
}

.scroll-end-spacer {
  height: 2rem;
}

.composer {
  --background: transparent;
  width: 100%;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: var(--ion-color-medium);
}
</style>
