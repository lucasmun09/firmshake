import { nextTick, ref, unref, type ComputedRef, type Ref } from 'vue';
import type { IonContent } from '@ionic/vue';

import { currentUser } from '@/features/auth/services/auth';
import {
  createOptimisticMessage,
  sendListingMessage,
} from '@/features/messages/services/messages';
import {
  normalizeMessageImageUrl,
  resolveMessageTextForSend,
} from '@/features/messages/utils/messageImage';
import type { Message } from '@/types';

type ScrollTarget = Ref<InstanceType<typeof IonContent> | null> | ComputedRef<InstanceType<typeof IonContent> | null>;

export function useListingChat(
  externalMessages?: Ref<Message[]>,
  scrollContentRef?: ScrollTarget,
) {
  const internalMessages = ref<Message[]>([]);
  const messages = externalMessages ?? internalMessages;
  const messageText = ref('');
  const pendingImageUrl = ref<string | null>(null);
  const sending = ref(false);
  const contentRef = ref<InstanceType<typeof IonContent> | null>(null);

  async function scrollToLatest() {
    await nextTick();

    const ionContent = scrollContentRef ? unref(scrollContentRef) : contentRef.value;
    if (!ionContent?.$el) {
      return;
    }

    try {
      await Promise.race([
        ionContent.$el.scrollToTop(300),
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
    const imageUrl = normalizeMessageImageUrl(pendingImageUrl.value ?? undefined);
    let textForSend: string;
    try {
      textForSend = resolveMessageTextForSend(messageText.value, imageUrl);
    } catch {
      return;
    }

    if (!user || sending.value) {
      return;
    }

    const senderName = user.displayName ?? 'FirmShake User';
    const optimistic = createOptimisticMessage(
      listingId,
      user.uid,
      senderName,
      textForSend,
      options?.recipientId,
      imageUrl,
    );

    messages.value = [...messages.value, optimistic];
    messageText.value = '';
    pendingImageUrl.value = null;
    sending.value = true;

    try {
      await sendListingMessage(listingId, senderName, textForSend, {
        recipientId: options?.recipientId,
        imageUrl,
      });
    } catch (error) {
      messages.value = messages.value.filter((message) => message.id !== optimistic.id);
      throw error;
    } finally {
      sending.value = false;
    }
  }

  return {
    messages,
    messageText,
    pendingImageUrl,
    sending,
    contentRef,
    scrollToLatest,
    sendMessage,
  };
}
