import { nextTick, ref, unref, type ComputedRef, type Ref } from 'vue';
import type { IonContent } from '@ionic/vue';

import { currentUser } from '@/services/auth';
import {
  createOptimisticMessage,
  sendListingMessage,
} from '@/services/messages';
import type { Message } from '@/types';

type ScrollTarget = Ref<InstanceType<typeof IonContent> | null> | ComputedRef<InstanceType<typeof IonContent> | null>;

export function useListingChat(
  externalMessages?: Ref<Message[]>,
  scrollContentRef?: ScrollTarget,
) {
  const internalMessages = ref<Message[]>([]);
  const messages = externalMessages ?? internalMessages;
  const messageText = ref('');
  const sending = ref(false);
  const contentRef = ref<InstanceType<typeof IonContent> | null>(null);

  async function scrollToBottom() {
    await nextTick();

    const ionContent = scrollContentRef ? unref(scrollContentRef) : contentRef.value;
    if (!ionContent?.$el) {
      return;
    }

    try {
      await Promise.race([
        ionContent.$el.scrollToBottom(300),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 400);
        }),
      ]);
    } catch {
      // Ignore scroll failures on pages where content is not ready yet.
    }
  }

  async function sendMessage(
    listingId: string,
    options?: { recipientId?: string },
  ): Promise<void> {
    const user = currentUser.value;
    const trimmed = messageText.value.trim();
    if (!user || !trimmed || sending.value) {
      return;
    }

    const senderName = user.displayName ?? 'FirmShake User';
    const optimistic = createOptimisticMessage(
      listingId,
      user.uid,
      senderName,
      trimmed,
      options?.recipientId,
    );

    messages.value = [...messages.value, optimistic];
    messageText.value = '';
    sending.value = true;
    await scrollToBottom();

    try {
      await sendListingMessage(listingId, senderName, trimmed, {
        recipientId: options?.recipientId,
      });
    } catch (error) {
      messages.value = messages.value.filter((message) => message.id !== optimistic.id);
      throw error;
    } finally {
      sending.value = false;
      await scrollToBottom();
    }
  }

  return {
    messages,
    messageText,
    sending,
    contentRef,
    scrollToBottom,
    sendMessage,
  };
}
