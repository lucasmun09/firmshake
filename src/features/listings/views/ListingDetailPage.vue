<template>
  <ion-page class="listing-page">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/home" />
        </ion-buttons>
        <ion-title>{{ listing?.title ?? 'Listing' }}</ion-title>
        <ion-buttons v-if="listing && isSeller && listing.status === 'active'" slot="end">
          <ion-button :router-link="`/listing/${listing.id}/edit`">Edit</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content v-if="loading || !listing" class="listing-content">
      <AppContentFrame>
        <ListingDetailSkeleton v-if="loading" />
        <div v-else class="empty-state">
          <p>Listing not found.</p>
        </div>
      </AppContentFrame>
    </ion-content>

    <ion-content
      v-else
      ref="contentRef"
      class="listing-content"
      @ionScroll="onContentScroll"
    >
      <AppContentFrame>
      <ListingPhotoGallery
        :image-urls="listing.imageUrls"
        :title="listing.title"
      />

      <div ref="stickyBlockRef" class="listing-sticky">
        <div class="details">
          <ion-note v-if="listing.status === 'removed'" color="warning" class="removed-banner">
            This listing has been delisted and is no longer available.
          </ion-note>

          <h1>{{ listing.title }}</h1>
          <p class="price">{{ formatPrice(listing.price) }}</p>
          <p class="seller">Seller: {{ listing.sellerName }}</p>
          <ion-chip color="tertiary" outline>{{ categoryName }}</ion-chip>
          <p class="description">{{ listing.description }}</p>

          <ListingRoughLocationMap
            :listing-id="listing.id"
            :location="listing.location"
          />

          <div v-if="isGuest && listing.status === 'active'" class="guest-cta">
            <p class="guest-cta__text">
              Sign in to message the seller, propose a FirmShake, and track your buying activity.
            </p>
            <ion-button expand="block" router-link="/tabs/login-create">
              Login / Create
            </ion-button>
          </div>

          <ion-chip v-for="name in communityNames" :key="name" color="primary" outline>
            {{ name }}
          </ion-chip>

          <div v-if="showDelistAction || showModeratorRemoveAction" class="moderation-actions">
            <ion-button
              v-if="showDelistAction"
              expand="block"
              color="medium"
              fill="outline"
              :disabled="removingListing"
              @click="confirmDelist"
            >
              {{ removingListing ? 'Delisting...' : 'Delist item' }}
            </ion-button>
            <ion-button
              v-if="showModeratorRemoveAction"
              expand="block"
              color="danger"
              fill="outline"
              :disabled="removingListing"
              @click="confirmModeratorRemove"
            >
              {{ removingListing ? 'Removing...' : 'Remove listing' }}
            </ion-button>
          </div>
        </div>

        <ListingMeetupSection
          v-if="listing.status === 'active' && !isGuest"
          :is-seller="isSeller"
          :listing-id="listing.id"
          :buyer-agreement="buyerAgreement"
          :seller-agreements="sellerAgreements"
          :busy="meetupBusy"
          :blocked-partner-id="messagingDisabled ? conversationPartnerId : null"
          @accept="handleAcceptProposal"
          @decline="handleDeclineProposal"
          @pay-deposit="handlePayDeposit"
          @start-meetup="handleStartMeetup"
        />

        <ListingChatSection
          v-if="listing.status === 'active' && !isGuest"
          variant="header"
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
          :inbox-link="messagesTabLink"
          :messages-loading="messagesLoading"
          :message-skeleton-count="messageSkeletonCount"
          buyer-hint="Chat with the seller about this listing."
          seller-hint="Select a buyer to view and reply to their messages."
          @select-conversation="selectBuyerConversation"
          @back-to-list="clearBuyerConversation"
          @toggle-block="handleToggleBlock"
        />
      </div>

      <div
        v-if="useNestedChatScroll && listing.status === 'active' && !isGuest"
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
          :display-messages="visibleMessages"
          :participant-profiles="participantProfiles"
          :messages-loading="messagesLoading"
          :message-skeleton-count="messageSkeletonCount"
          @select-conversation="selectBuyerConversation"
          @back-to-list="clearBuyerConversation"
        />
      </div>

      <div v-else-if="listing.status === 'active' && !isGuest" class="messages-body-anchor">
        <ListingChatSection
          variant="body"
          :is-seller="isSeller"
          :current-user-id="currentUser?.uid"
          :messages-error="messagesError"
          :conversations="conversations"
          :selected-buyer-id="selectedBuyerId"
          :selected-buyer-name="selectedBuyerName"
          :display-messages="visibleMessages"
          :participant-profiles="participantProfiles"
          :messages-loading="messagesLoading"
          :message-skeleton-count="messageSkeletonCount"
          @select-conversation="selectBuyerConversation"
          @back-to-list="clearBuyerConversation"
        />
      </div>

      <div class="scroll-end-spacer" />
      </AppContentFrame>
    </ion-content>

    <ion-footer v-if="listing && !loading && showComposer && listing.status === 'active' && !isGuest">
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
  IonNote,
  IonPage,
  IonTitle,
  IonToolbar,
  alertController,
  toastController,
} from '@ionic/vue';

import ListingMeetupSection from '@/features/meetups/components/ListingMeetupSection.vue';
import ListingPhotoGallery from '@/features/listings/components/ListingPhotoGallery.vue';
import ListingRoughLocationMap from '@/features/listings/components/ListingRoughLocationMap.vue';
import ListingChatSection from '@/features/messages/components/ListingChatSection.vue';
import AppContentFrame from '@/components/AppContentFrame.vue';
import ListingDetailSkeleton from '@/components/skeletons/ListingDetailSkeleton.vue';
import { useLazyReveal } from '@/common/composables/useLazyReveal';
import { useListingChat } from '@/features/messages/composables/useListingChat';
import { useListingNestedChatScroll } from '@/features/messages/composables/useListingNestedChatScroll';
import { useParticipantProfiles } from '@/common/composables/useParticipantProfiles';
import {
  acceptMeetupProposal,
  cancelActiveAgreementOnBlock,
  confirmMeetupDeposit,
  declineMeetupProposal,
  findAgreementForBuyer,
  findBuyerAgreementForListing,
  isActiveAgreement,
  startMeetupEnRoute,
  subscribeAgreement,
  subscribeListingAgreements,
} from '@/common/services/agreements';
import { authReady, currentUser } from '@/features/auth/services/auth';
import {
  bootstrapCommunities,
  bootstrapProfile,
  waitForBootstrap,
} from '@/common/services/appBootstrap';
import { fetchCategories, getCategoryName } from '@/features/listings/services/categories';
import { getCommunityName } from '@/features/communities/services/communities';
import { getListingById, removeListing } from '@/features/listings/services/listings';
import { prefetchAuthenticatedImages } from '@/common/services/images';
import {
  getMessageAccessOptions,
  subscribeListingMessages,
} from '@/features/messages/services/messages';
import {
  confirmBlockUser,
  resolveBlockedDisplayName,
  showBlockSuccessToast,
} from '@/common/services/blockUi';
import { blockUser, subscribeUserBlocked, unblockUser } from '@/common/services/blocks';
import { syncMessageThreadForUser } from '@/features/messages/services/threads';
import {
  canDelistOwnListing,
  canModerateListing,
} from '@/utils/moderation';
import {
  filterMessagesForParticipant,
  getConversationMessages,
  groupMessagesByBuyer,
} from '@/features/listings/utils/listingConversations';
import type { Agreement, Listing, Message } from '@/types';

const route = useRoute();
const router = useRouter();
const listing = ref<Listing | null>(null);
const profile = bootstrapProfile;
const communities = bootstrapCommunities;
const loading = ref(true);
const removingListing = ref(false);
const communityNames = ref<string[]>([]);
const categoryName = ref('General');
const categories = ref<Awaited<ReturnType<typeof fetchCategories>>>([]);
const meetupBusy = ref(false);
const buyerAgreement = ref<Agreement | null>(null);
const sellerAgreements = ref<Agreement[]>([]);
const messagesError = ref('');
const messagesReady = ref(false);
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
  scrollChatIfAtTop,
  scrollChatToTop,
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

const messagesTabLink = computed(() => {
  if (!listing.value) {
    return '/tabs/buying';
  }

  return isSeller.value
    ? `/tabs/selling/listing/${listing.value.id}`
    : `/tabs/buying/listing/${listing.value.id}`;
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

const messagesLoading = computed(
  () => Boolean(listing.value) && !messagesReady.value && !messagesError.value,
);

const {
  visibleItems: visibleMessages,
  skeletonCount: messageSkeletonCount,
  onScroll: onLazyScroll,
} = useLazyReveal(displayMessages, {
  contentRef,
  loading: messagesLoading,
  estimatedItemHeight: 64,
});

async function onContentScroll() {
  await onLazyScroll();
}

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

const activeAgreementForBlock = computed(() => {
  if (isSeller.value) {
    if (!selectedBuyerId.value) {
      return null;
    }

    return findAgreementForBuyer(sellerAgreements.value, selectedBuyerId.value);
  }

  return buyerAgreement.value;
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

const isGuest = computed(() => authReady.value && !currentUser.value);

const showDelistAction = computed(() =>
  Boolean(listing.value && profile.value && canDelistOwnListing(profile.value, listing.value)),
);

const showModeratorRemoveAction = computed(() =>
  Boolean(
    listing.value &&
      profile.value &&
      canModerateListing(profile.value, listing.value) &&
      !canDelistOwnListing(profile.value, listing.value),
  ),
);

let unsubscribeMessages: (() => void) | undefined;
let unsubscribeBlockedByMe: (() => void) | undefined;
let unsubscribeBlockedByOther: (() => void) | undefined;
let unsubscribeBuyerAgreement: (() => void) | undefined;
let unsubscribeSellerAgreements: (() => void) | undefined;
let loadingListingFor: string | null = null;
let blockeeCancelInFlight: string | null = null;

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
      messagesReady.value = true;
      void scrollChatIfAtTop();
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
  stopBlockSubscriptions();
}

async function cancelAgreementIfBlockedByOther() {
  if (!blockedByOther.value) {
    return;
  }

  const user = currentUser.value;
  const agreement = activeAgreementForBlock.value;
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

async function loadMessagesForListing(loadedListing: Listing) {
  selectedBuyerId.value = null;
  stopMessageSubscription();
  stopBlockSubscriptions();

  const user = currentUser.value;
  if (!user) {
    messagesError.value = '';
    messagesReady.value = true;
    return;
  }

  messagesError.value = '';
  startMessages(loadedListing);
  startBlockSubscriptions();
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
  messagesReady.value = false;
  chatPanelMaxHeight.value = null;
  stopMessageSubscription();
  stopAgreementSubscriptions();
  allMessages.value = [];
  selectedBuyerId.value = null;
  buyerAgreement.value = null;
  sellerAgreements.value = [];

  try {
    await waitForAuthReady();
    await waitForBootstrap();
    categories.value = await fetchCategories();

    const loadedListing = await getListingById(listingId, { preferCache: true });
    const loadedCommunities = bootstrapCommunities.value;

    listing.value = loadedListing;

    if (loadedListing) {
      categoryName.value = getCategoryName(categories.value, loadedListing.primaryCategoryId);
      communityNames.value = loadedListing.communityIds
        .map((id) => getCommunityName(loadedCommunities, id))
        .filter((name): name is string => Boolean(name));

      void prefetchAuthenticatedImages(loadedListing.imageUrls);

      startAgreementSubscriptions(listingId, loadedListing);
      void loadMessagesForListing(loadedListing);

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
      void scrollChatIfAtTop();
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

watch(blockedByOther, (blocked) => {
  if (blocked) {
    void cancelAgreementIfBlockedByOther();
  }
});

watch(activeAgreementForBlock, () => {
  if (blockedByOther.value) {
    void cancelAgreementIfBlockedByOther();
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
    await scrollChatToTop();
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
      message: error instanceof Error ? error.message : 'Could not accept FirmShake request',
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
      message: error instanceof Error ? error.message : 'Could not decline FirmShake request',
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

async function confirmDelist() {
  if (!listing.value || !profile.value) {
    return;
  }

  const alert = await alertController.create({
    header: 'Delist item?',
    message: 'This removes the listing from the marketplace. You can still see it in your selling history.',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Delist',
        role: 'destructive',
        handler: () => {
          void performRemoveListing();
        },
      },
    ],
  });

  await alert.present();
}

async function confirmModeratorRemove() {
  if (!listing.value || !profile.value) {
    return;
  }

  const alert = await alertController.create({
    header: 'Remove listing?',
    message: 'This delists the item for everyone in its communities.',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Remove',
        role: 'destructive',
        handler: () => {
          void performRemoveListing();
        },
      },
    ],
  });

  await alert.present();
}

async function performRemoveListing() {
  if (!listing.value || !profile.value) {
    return;
  }

  removingListing.value = true;

  try {
    const updated = await removeListing(listing.value.id, profile.value);
    listing.value = updated;

    const toast = await toastController.create({
      message: 'Listing removed from the marketplace',
      duration: 2500,
      color: 'success',
    });
    await toast.present();

    if (isSeller.value) {
      void router.replace('/tabs/selling');
    } else {
      void router.replace('/tabs/home');
    }
  } catch (error) {
    const toast = await toastController.create({
      message: error instanceof Error ? error.message : 'Could not remove listing',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    removingListing.value = false;
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
  --listing-hero-height: 50dvh;
}

.listing-sticky {
  position: sticky;
  top: 0;
  z-index: 3;
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

.removed-banner {
  display: block;
  margin-bottom: 0.75rem;
}

.moderation-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}

.guest-cta {
  margin: 1.25rem 0 0;
  padding: 1rem;
  border-radius: 12px;
  background: var(--ion-color-step-50);
  border: 1px solid var(--ion-color-step-150);
}

.guest-cta__text {
  margin: 0 0 0.75rem;
  color: var(--ion-color-medium);
  line-height: 1.45;
}

.messages-body-anchor {
  min-height: 1px;
}

.chat-scroll-panel {
  position: relative;
  z-index: 1;
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
