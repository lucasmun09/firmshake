<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button
            v-if="isSeller && selectedBuyerId"
            fill="clear"
            @click="clearBuyerConversation"
          >
            <ion-icon slot="icon-only" :icon="chevronBackOutline" />
          </ion-button>
          <ion-back-button v-else default-href="/tabs/inbox" />
        </ion-buttons>
        <ion-title>{{ pageTitle }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content v-if="loading" class="ion-padding">
      <AppContentFrame>
      <div class="empty-state">
        <ion-spinner name="crescent" />
        <p>Loading messages...</p>
      </div>
      </AppContentFrame>
    </ion-content>

    <ion-content v-else-if="listing" ref="contentRef" class="chat-content">
      <AppContentFrame>
      <div class="listing-summary">
        <AuthenticatedImage :src="listing.imageUrl" :alt="listing.title" />
        <div>
          <h2>{{ listing.title }}</h2>
          <p>{{ formatPrice(listing.price) }} · Seller: {{ listing.sellerName }}</p>
        </div>
      </div>

      <ListingChatSection
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
        buyer-hint="Chat with the seller about this listing."
        seller-hint="Select a buyer to view and reply to their messages."
        @select-conversation="selectBuyerConversation"
        @back-to-list="clearBuyerConversation"
        @toggle-block="handleToggleBlock"
      />
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
import { computed, onUnmounted, ref, watch } from 'vue';
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
  IonSpinner,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue';
import { chevronBackOutline } from 'ionicons/icons';

import ListingChatSection from '@/components/ListingChatSection.vue';
import AppContentFrame from '@/components/AppContentFrame.vue';
import AuthenticatedImage from '@/components/AuthenticatedImage.vue';
import { useListingChat } from '@/composables/useListingChat';
import { authReady, currentUser } from '@/services/auth';
import { blockUser, subscribeUserBlocked, unblockUser } from '@/services/blocks';
import { getListingById } from '@/services/listings';
import {
  fetchListingMessages,
  getMessageAccessOptions,
  subscribeListingMessages,
} from '@/services/messages';
import { markListingNotificationsRead, markListingThreadRead } from '@/services/notifications';
import { syncMessageThreadForUser } from '@/services/threads';
import {
  filterMessagesForParticipant,
  getConversationMessages,
  groupMessagesByBuyer,
} from '@/utils/listingConversations';
import type { Listing, Message } from '@/types';

const route = useRoute();
const router = useRouter();

const listing = ref<Listing | null>(null);
const loading = ref(true);
const messagesError = ref('');
const allMessages = ref<Message[]>([]);
const selectedBuyerId = ref<string | null>(null);
const blockedByMe = ref(false);
const blockedByOther = ref(false);

const {
  messageText,
  sending,
  contentRef,
  scrollToBottom,
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

  return groupMessagesByBuyer(allMessages.value, listing.value.sellerId);
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

const pageTitle = computed(() => {
  if (isSeller.value && selectedBuyerId.value) {
    return selectedBuyerName.value;
  }

  return listing.value?.title ?? 'Messages';
});

let unsubscribeMessages: (() => void) | undefined;
let unsubscribeBlockedByMe: (() => void) | undefined;
let unsubscribeBlockedByOther: (() => void) | undefined;

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

function selectBuyerConversation(buyerId: string) {
  selectedBuyerId.value = buyerId;
  void router.replace({
    name: 'ListingMessages',
    params: { id: route.params.id as string },
    query: { buyerId },
  });
  void scrollToBottom();
}

function clearBuyerConversation() {
  selectedBuyerId.value = null;
  messageText.value = '';
  void router.replace({
    name: 'ListingMessages',
    params: { id: route.params.id as string },
  });
}

watch(
  () => displayMessages.value.length,
  () => {
    void scrollToBottom();
  },
);

watch(conversationPartnerId, () => {
  startBlockSubscriptions();
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
  loading.value = true;
  messagesError.value = '';

  try {
    await waitForAuthReady();
    listing.value = await getListingById(listingId);

    if (listing.value && user) {
      selectedBuyerId.value = isSeller.value ? readBuyerIdFromRoute() : null;
      const access = getMessageAccessOptions(listing.value, user.uid);

      try {
        allMessages.value = await fetchListingMessages(listingId, access);
      } catch (error) {
        messagesError.value = 'Unable to fetch messages';
        console.error('Failed to load listing messages', error);
      }

      unsubscribeMessages?.();
      unsubscribeMessages = subscribeListingMessages(
        listingId,
        (nextMessages) => {
          messagesError.value = '';
          allMessages.value = nextMessages;
        },
        (error) => {
          messagesError.value = 'Unable to fetch messages';
          console.error(error);
        },
        access,
      );

      startBlockSubscriptions();

      if (allMessages.value.length > 0 && !messagesError.value) {
        void syncMessageThreadForUser(
          user.uid,
          listing.value,
          allMessages.value[allMessages.value.length - 1],
        ).catch((error) => {
          console.warn('Could not backfill message thread', error);
        });

        await Promise.all([
          markListingThreadRead(user.uid, listingId),
          markListingNotificationsRead(user.uid, listingId),
        ]);
      }
    }
  } finally {
    loading.value = false;
    await scrollToBottom();
  }
}

onIonViewWillEnter(() => {
  void loadThread();
});

onUnmounted(() => {
  unsubscribeMessages?.();
  stopBlockSubscriptions();
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
</style>
