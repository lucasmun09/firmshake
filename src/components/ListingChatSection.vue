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
          Open inbox
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
              <p v-if="conversation.lastMessage">
                <span v-if="conversation.lastMessage.senderId === currentUserId">You: </span>
                {{ conversation.lastMessage.text }}
              </p>
            </ion-label>
          </ion-item>
        </ion-list>
      </template>

      <template v-else>
        <div v-if="displayMessages.length === 0" class="chat-empty">
          <p>{{ emptyMessage }}</p>
        </div>

        <div v-else class="chat-messages">
          <div v-for="message in displayMessages" :key="message.id" class="message-row">
            <div
              class="message-bubble"
              :class="{ mine: message.senderId === currentUserId }"
            >
              <p class="message-sender">{{ message.senderName }}</p>
              <p class="message-text">{{ message.text }}</p>
              <p v-if="message.createdAt" class="message-time">
                {{ formatMessageTimestamp(message.createdAt) }}
              </p>
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

import type { ListingConversation, Message } from '@/types';
import { formatMessageTimestamp } from '@/utils/dateTime';

const props = withDefaults(
  defineProps<{
    isSeller: boolean;
    currentUserId?: string;
    messagesError?: string;
    conversations: ListingConversation[];
    selectedBuyerId?: string | null;
    selectedBuyerName?: string;
    displayMessages: Message[];
    inboxLink?: string;
    buyerHint?: string;
    sellerHint?: string;
    conversationPartnerId?: string | null;
    blockedByMe?: boolean;
    blockedByOther?: boolean;
    showBlockAction?: boolean;
    variant?: 'full' | 'header' | 'body';
  }>(),
  {
    variant: 'full',
  },
);

defineEmits<{
  'select-conversation': [buyerId: string];
  'back-to-list': [];
  'toggle-block': [];
}>();

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

.chat-messages {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.message-row {
  margin: 0.75rem 0;
  display: flex;
}

.message-bubble {
  max-width: 85%;
  background: var(--ion-color-step-100);
  border-radius: 12px;
  padding: 0.6rem 0.8rem;
}

.message-bubble.mine {
  margin-left: auto;
  background: var(--ion-color-primary-tint);
}

.message-sender {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ion-color-medium);
}

.message-text {
  margin: 0.25rem 0 0;
  color: var(--ion-text-color);
}

.message-time {
  margin: 0.35rem 0 0;
  font-size: 0.7rem;
  color: var(--ion-color-medium);
}
</style>
