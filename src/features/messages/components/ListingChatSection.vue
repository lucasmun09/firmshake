<template>
  <div class="chat-section" :class="{ 'chat-section--body': variant === 'body' }">
    <template v-if="variant !== 'body'">
      <div class="chat-header">
        <div class="chat-header-title">
          <ion-button
            v-if="isSeller && selectedBuyerId"
            fill="clear"
            size="small"
            class="back-button"
            @click="$emit('back-to-list')"
          >
            <ion-icon slot="icon-only" :icon="chevronBackOutline" />
          </ion-button>
          <h2>{{ headerTitle }}</h2>
        </div>
        <ion-button
          v-if="inboxLink"
          fill="clear"
          size="small"
          :router-link="inboxLink"
        >
          Open messages
        </ion-button>
      </div>

      <p v-if="hint" class="chat-hint">{{ hint }}</p>
      <p v-if="blockedByMe" class="chat-hint chat-blocked">
        You blocked this user. Unblock to send messages again.
      </p>
      <p v-else-if="blockedByOther" class="chat-hint chat-blocked">
        This user is not accepting messages from you.
      </p>
      <ion-button
        v-if="showBlockAction && conversationPartnerId"
        fill="clear"
        size="small"
        :color="blockedByMe ? 'medium' : 'danger'"
        @click="$emit('toggle-block')"
      >
        {{ blockedByMe ? 'Unblock user' : 'Block user' }}
      </ion-button>
    </template>

    <template v-if="variant !== 'header'">
      <div v-if="messagesError" class="chat-empty chat-error">
        <p>{{ messagesError }}</p>
      </div>

      <template v-else-if="isSeller && !selectedBuyerId">
        <div v-if="conversations.length === 0" class="chat-empty">
          <p>No buyer messages yet.</p>
        </div>

        <ion-list v-else lines="full" class="conversation-list">
          <ion-item
            v-for="conversation in conversations"
            :key="conversation.buyerId"
            button
            detail
            @click="$emit('select-conversation', conversation.buyerId)"
          >
            <ion-label>
              <h2>{{ conversation.buyerName }}</h2>
              <p v-if="buyerFirmShakeLabels?.[conversation.buyerId]" class="firmshake-badge">
                {{ buyerFirmShakeLabels[conversation.buyerId] }}
              </p>
              <p v-if="conversation.lastMessage">
                <span v-if="conversation.lastMessage.senderId === currentUserId">You: </span>
                {{ conversation.lastMessage.text }}
              </p>
            </ion-label>
            <ConversationOverflowMenu
              v-if="archiveListingId"
              slot="end"
              :listing-id="archiveListingId"
              :buyer-id="conversation.buyerId"
              :is-archived="false"
            />
          </ion-item>
        </ion-list>
      </template>

      <template v-else>
        <div v-if="messagesLoading" class="chat-messages">
          <MessageBubbleSkeleton
            v-for="index in messageSkeletonCount"
            :key="`msg-skeleton-${index}`"
            :align="index % 2 === 0 ? 'left' : 'right'"
          />
        </div>

        <div v-else-if="orderedMessages.length === 0" class="chat-empty">
          <p>{{ emptyMessage }}</p>
        </div>

        <div v-else class="chat-messages">
          <div
            v-for="message in orderedMessages"
            :key="message.id"
            class="message-row"
            :class="{ mine: message.senderId === currentUserId }"
          >
            <div class="message-unit">
              <div
                class="message-bubble"
                :class="{ mine: message.senderId === currentUserId }"
              >
                <p class="message-text">{{ message.text }}</p>
                <p v-if="message.createdAt" class="message-time">
                  {{ formatMessageTimestamp(message.createdAt) }}
                </p>
              </div>
              <UserAvatar
                class="message-avatar"
                size="xs"
                :name="senderProfile(message).displayName"
                :photo-url="senderProfile(message).photoUrl"
              />
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonButton, IonIcon, IonItem, IonLabel, IonList } from '@ionic/vue';
import { chevronBackOutline } from 'ionicons/icons';

import UserAvatar from '@/components/UserAvatar.vue';
import ConversationOverflowMenu from '@/features/messages/components/ConversationOverflowMenu.vue';
import MessageBubbleSkeleton from '@/components/skeletons/MessageBubbleSkeleton.vue';
import type { ListingConversation, Message } from '@/types';
import type { ParticipantProfile } from '@/common/composables/useParticipantProfiles';
import { formatMessageTimestamp } from '@/utils/dateTime';
import { sortMessagesNewestFirst } from '@/features/listings/utils/listingConversations';

const props = withDefaults(
  defineProps<{
    isSeller: boolean;
    currentUserId?: string;
    messagesError?: string;
    conversations: ListingConversation[];
    selectedBuyerId?: string | null;
    selectedBuyerName?: string;
    displayMessages: Message[];
    participantProfiles?: Record<string, ParticipantProfile>;
    inboxLink?: string;
    buyerHint?: string;
    sellerHint?: string;
    conversationPartnerId?: string | null;
    blockedByMe?: boolean;
    blockedByOther?: boolean;
    showBlockAction?: boolean;
    buyerFirmShakeLabels?: Record<string, string>;
    archiveListingId?: string;
    variant?: 'full' | 'header' | 'body';
    messagesLoading?: boolean;
    messageSkeletonCount?: number;
  }>(),
  {
    variant: 'full',
    messageSkeletonCount: 6,
  },
);

defineEmits<{
  'select-conversation': [buyerId: string];
  'back-to-list': [];
  'toggle-block': [];
}>();

const orderedMessages = computed(() => sortMessagesNewestFirst(props.displayMessages));

const headerTitle = computed(() => {
  if (props.isSeller && props.selectedBuyerId) {
    return props.selectedBuyerName ?? 'Conversation';
  }

  return props.isSeller ? 'Buyer messages' : 'Messages';
});

const hint = computed(() => {
  if (props.isSeller && props.selectedBuyerId) {
    return `Replying to ${props.selectedBuyerName ?? 'buyer'}`;
  }

  return props.isSeller ? props.sellerHint : props.buyerHint;
});

const emptyMessage = computed(() =>
  props.isSeller ? 'No messages in this conversation yet.' : 'No messages yet. Say hello!',
);

function senderProfile(message: Message): ParticipantProfile {
  return (
    props.participantProfiles?.[message.senderId] ?? {
      displayName: message.senderName,
    }
  );
}
</script>

<style scoped>
.chat-section {
  padding: 0 1rem 1rem;
  border-top: 1px solid var(--ion-color-step-150);
}

.chat-section--body {
  border-top: none;
  padding: 0.75rem 1rem 1rem;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.chat-header-title {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.chat-header h2 {
  margin: 0;
  font-size: 1.1rem;
}

.back-button {
  margin: 0;
  --padding-start: 0;
  --padding-end: 0;
}

.chat-hint,
.chat-empty {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.chat-error,
.chat-blocked {
  color: var(--ion-color-danger);
}

.conversation-list {
  margin-top: 0.5rem;
}

.firmshake-badge {
  color: var(--ion-color-primary);
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0.15rem 0;
}

.chat-messages {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.message-row {
  display: flex;
  justify-content: flex-start;
}

.message-row.mine {
  justify-content: flex-end;
}

.message-unit {
  position: relative;
  max-width: min(85%, 320px);
  padding-right: 10px;
  padding-bottom: 10px;
}

.message-bubble {
  background: var(--ion-color-step-100);
  border-radius: 16px 16px 4px 16px;
  padding: 0.65rem 0.85rem 0.55rem;
}

.message-bubble.mine {
  background: var(--ion-color-primary-tint);
  border-radius: 16px 16px 16px 4px;
}

.message-text {
  margin: 0;
  color: var(--ion-text-color);
  line-height: 1.35;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-time {
  margin: 0.35rem 0 0;
  font-size: 0.7rem;
  color: var(--ion-color-medium);
}

.message-avatar {
  position: absolute;
  right: 0;
  bottom: 0;
  box-shadow: 0 0 0 2px var(--ion-background-color, #121212);
}

@media (prefers-color-scheme: dark) {
  .message-bubble {
    background: var(--ion-color-step-150);
    border: 1px solid var(--ion-color-step-200);
  }

  .message-bubble.mine {
    background: var(--ion-color-step-200);
    border-color: var(--ion-color-step-250);
  }

  .message-text {
    color: var(--ion-color-step-850);
  }

  .message-time {
    color: var(--ion-color-step-500);
  }

  .message-avatar {
    box-shadow: 0 0 0 2px var(--ion-color-step-150);
  }

  .message-avatar :deep(.user-avatar) {
    background: var(--ion-color-step-300);
    color: var(--ion-color-step-750);
  }
}
</style>
